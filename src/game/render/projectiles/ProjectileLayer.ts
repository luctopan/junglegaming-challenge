import type { Texture } from 'pixi.js';
import { Container, Sprite } from 'pixi.js';
import { trackResource } from '../../../platform/resourceCounters';
import type { GameConfig } from '../../../config/gameConfig';
import type { Atlas } from '../assets/atlas';
import type { Pool } from '../pool';
import { createPool } from '../pool';
import { PROJECTILE_ART } from '../theme';
import type { ProjectileState } from '../worldView';
import { createTrailTexture } from './trailTexture';

interface BallView {
  readonly root: Container;
  readonly ball: Sprite;
  readonly trail: Sprite;
  seenFrame: number;
}

/**
 * Cannon balls with a short white streak that fades towards its tail (one
 * shared gradient texture); one pooled view per live projectile.
 */
export class ProjectileLayer {
  readonly view = new Container();
  readonly #pool: Pool<BallView>;
  readonly #trailTexture: Texture = createTrailTexture(PROJECTILE_ART.trail.gradientSteps);
  readonly #releaseTrailTexture = trackResource('dynamicTextures');
  readonly #byId = new Map<number, BallView>();
  #frame = 0;

  constructor(atlas: Atlas) {
    const texture = atlas.texture(PROJECTILE_ART.frame);
    this.#pool = createPool<BallView>({
      create: () => {
        const root = new Container();
        const trail = new Sprite(this.#trailTexture);
        trail.anchor.set(1, 0.5);
        trail.tint = PROJECTILE_ART.trail.color;
        trail.alpha = PROJECTILE_ART.trail.alpha;
        trail.height = PROJECTILE_ART.trail.width;
        const ball = new Sprite(texture);
        ball.anchor.set(0.5);
        root.addChild(trail, ball);
        return { root, ball, trail, seenFrame: 0 };
      },
      reset: (item) => {
        item.root.visible = false;
        item.root.removeFromParent();
      },
      dispose: (item) => {
        item.root.destroy({ children: true });
      },
    });
  }

  sync(
    projectiles: readonly ProjectileState[],
    weapons: GameConfig['weapons'],
    alpha: number,
  ): void {
    this.#frame += 1;
    for (const p of projectiles) {
      if (!p.alive) continue;
      let view = this.#byId.get(p.id);
      if (view === undefined) {
        view = this.#pool.acquire();
        view.root.visible = true;
        this.view.addChild(view.root);
        this.#byId.set(p.id, view);
      }
      view.seenFrame = this.#frame;
      view.root.position.set(
        p.prevPos.x + (p.pos.x - p.prevPos.x) * alpha,
        p.prevPos.y + (p.pos.y - p.prevPos.y) * alpha,
      );
      view.trail.rotation = Math.atan2(p.vel.y, p.vel.x);
      // The trail grows from the muzzle, so it never reaches back past the gun.
      const travelled = weapons[p.cannon].projectileRange - p.distanceLeft;
      view.trail.width = Math.max(0, Math.min(PROJECTILE_ART.trail.maxLength, travelled));
    }
    for (const [id, view] of this.#byId) {
      if (view.seenFrame !== this.#frame) {
        this.#byId.delete(id);
        this.#pool.release(view);
      }
    }
  }

  get activeViews(): number {
    return this.#pool.active;
  }

  reset(): void {
    for (const view of this.#byId.values()) this.#pool.release(view);
    this.#byId.clear();
  }

  destroy(): void {
    this.#byId.clear();
    this.#pool.destroy();
    this.view.destroy({ children: true });
    this.#trailTexture.destroy(true);
    this.#releaseTrailTexture();
  }
}
