import { Container } from 'pixi.js';
import type { DomainEvent } from '../core';
import type { CombatAtlases } from './assets/atlas';
import { ArenaLayer } from './arena/ArenaLayer';
import type { ArenaGrid } from './arena/arenaLayout';
import type { EffectContext } from './effects/effectRequests';
import { effectRequestsFor } from './effects/effectRequests';
import { EffectLayer } from './effects/EffectLayer';
import type { Pose } from './interpolate';
import { createPose, interpolatePose } from './interpolate';
import type { Pool } from './pool';
import { createPool } from './pool';
import { ProjectileLayer } from './projectiles/ProjectileLayer';
import { ShipView } from './ships/ShipView';
import { CAMERA_SHAKE } from './theme';
import type { Viewport } from './viewport';
import type { WorldView } from './worldView';

/** Counts for the resource report and tests. */
export interface RenderStats {
  readonly shipViews: number;
  readonly projectileViews: number;
  readonly effects: number;
}

/**
 * Draws a `WorldView` with Pixi. It only reads simulation state (`sync`) and
 * reacts to domain events (`playEvents`); it never changes the world. Views are
 * pooled and keyed by entity id, so a restart just releases them for reuse.
 */
export class WorldRenderer {
  /** Add to the stage; positioned and scaled by `setViewport`. */
  readonly root = new Container();
  /** Free layer above everything else (dev overlays). */
  readonly overlay = new Container();
  readonly #world = new Container();
  readonly #arena: ArenaLayer;
  readonly #wrecks = new Container();
  readonly #ships = new Container();
  readonly #projectiles: ProjectileLayer;
  readonly #effects: EffectLayer;
  readonly #bars = new Container();
  readonly #shipPool: Pool<ShipView>;
  readonly #shipViews = new Map<number, ShipView>();
  readonly #pose: Pose = createPose();
  #viewport: Viewport | null = null;
  #shakeLeft = 0;
  #time = 0;
  #frame = 0;
  readonly #seen = new Map<number, number>();

  constructor(atlases: CombatAtlases, arena: ArenaGrid) {
    const arenaSize = { width: arena.cols * arena.tileSize, height: arena.rows * arena.tileSize };
    this.#arena = new ArenaLayer(atlases.tiles, arena);
    this.#projectiles = new ProjectileLayer(atlases.ships);
    this.#effects = new EffectLayer(atlases.ships);
    this.#shipPool = createPool<ShipView>({
      create: () => new ShipView(atlases.ships, atlases.ui, arenaSize),
      reset: (view) => {
        view.reset();
      },
      dispose: (view) => {
        view.destroy();
      },
    });
    // Bars on top of effects, so HP stays readable during explosions.
    this.#world.addChild(
      this.#arena.view,
      this.#wrecks,
      this.#ships,
      this.#projectiles.view,
      this.#effects.view,
      this.#bars,
      this.overlay,
    );
    this.root.addChild(this.#world);
  }

  setViewport(viewport: Viewport): void {
    this.#viewport = viewport;
    this.#arena.setViewport(viewport);
    this.#world.scale.set(viewport.scale);
    this.#applyCamera();
  }

  /** Effects, flashes and shake for the events of the steps just run. */
  playEvents(events: readonly DomainEvent[], world: WorldView): void {
    if (events.length === 0) return;
    const context: EffectContext = {
      playerId: world.playerId,
      headingOf: (id) => world.ships.find((s) => s.id === id)?.heading,
    };
    for (const event of events) {
      for (const request of effectRequestsFor(event, context)) {
        if (request.kind === 'flash') this.#shipViews.get(request.shipId)?.flash();
        else if (request.kind === 'shake') this.#shakeLeft = CAMERA_SHAKE.seconds;
        else this.#effects.play(request);
      }
    }
  }

  /** Advances cosmetic animations (effects, water, fire, shake) by real frame time. */
  update(dtSeconds: number): void {
    this.#time += dtSeconds;
    this.#arena.animate(dtSeconds);
    this.#effects.update(dtSeconds);
    for (const view of this.#shipViews.values()) view.animate(dtSeconds);
    this.#shakeLeft = Math.max(0, this.#shakeLeft - dtSeconds);
    this.#applyCamera();
  }

  /** Mirrors the world into the views; `alpha` interpolates between the last two steps. */
  sync(world: WorldView, alpha: number): void {
    this.#frame += 1;
    const { stageThresholds, wreckSeconds } = world.cfg.damage;
    for (const ship of world.ships) {
      let view = this.#shipViews.get(ship.id);
      if (view === undefined) {
        view = this.#shipPool.acquire();
        view.bind(ship.kind);
        this.#shipViews.set(ship.id, view);
        this.#bars.addChild(view.bar.view);
      }
      const layer = ship.alive ? this.#ships : this.#wrecks;
      if (view.body.parent !== layer) layer.addChild(view.body);
      this.#seen.set(ship.id, this.#frame);
      interpolatePose(this.#pose, ship.prevPos, ship.pos, ship.prevHeading, ship.heading, alpha);
      view.sync(ship, this.#pose, stageThresholds, wreckSeconds, this.#time);
    }
    for (const [id, view] of this.#shipViews) {
      if (this.#seen.get(id) !== this.#frame) {
        this.#shipViews.delete(id);
        this.#seen.delete(id);
        this.#shipPool.release(view);
      }
    }
    this.#projectiles.sync(world.projectiles, world.cfg.weapons, alpha);
  }

  get stats(): RenderStats {
    return {
      shipViews: this.#shipViews.size,
      projectileViews: this.#projectiles.activeViews,
      effects: this.#effects.activeEffects,
    };
  }

  /** New match: every entity view goes back to its pool; the arena art stays. */
  reset(): void {
    for (const view of this.#shipViews.values()) this.#shipPool.release(view);
    this.#shipViews.clear();
    this.#seen.clear();
    this.#projectiles.reset();
    this.#effects.reset();
    this.#shakeLeft = 0;
    this.#applyCamera();
  }

  destroy(): void {
    this.#shipViews.clear();
    this.#shipPool.destroy();
    this.#projectiles.destroy();
    this.#effects.destroy();
    this.#arena.destroy();
    this.root.destroy({ children: true });
  }

  #applyCamera(): void {
    const viewport = this.#viewport;
    if (viewport === null) return;
    // Deterministic shake: a fixed wobble scaled down as it decays (no randomness).
    const { seconds, amplitude, frequency, yFrequencyRatio } = CAMERA_SHAKE;
    const wobble = (this.#shakeLeft / seconds) * amplitude * viewport.scale;
    this.#world.position.set(
      viewport.offsetX + wobble * Math.sin(this.#time * frequency),
      viewport.offsetY + wobble * Math.cos(this.#time * frequency * yFrequencyRatio),
    );
  }
}
