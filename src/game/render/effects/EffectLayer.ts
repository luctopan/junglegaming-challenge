import { Container, Graphics, Sprite } from 'pixi.js';
import type { Rng } from '../../../shared/rng';
import { createRng, nextFloat, nextRange } from '../../../shared/rng';
import { TAU } from '../../../shared/math/constants';
import type { Atlas } from '../assets/atlas';
import type { Pool } from '../pool';
import { createPool } from '../pool';
import type { SpriteEffectArt } from '../theme';
import { EFFECT_ART } from '../theme';
import type { EffectRequest } from './effectRequests';

type SpriteKind = 'muzzle' | 'hit' | 'puff' | 'explosion';

interface SpriteEffect {
  readonly sprite: Sprite;
  art: SpriteEffectArt;
  age: number;
}

interface Splash {
  readonly ring: Graphics;
  age: number;
}

interface Debris {
  readonly sprite: Sprite;
  vx: number;
  vy: number;
  spin: number;
  age: number;
}

/**
 * Plays short visual effects from `EffectRequest`s. Every effect object comes
 * from a pool and goes back when its animation ends. Animation time is passed
 * in (`update(dt)`), so a frozen test clock freezes the effects too.
 */
export class EffectLayer {
  readonly view = new Container();
  readonly #sprites: Pool<SpriteEffect>;
  readonly #splashes: Pool<Splash>;
  readonly #debris: Pool<Debris>;
  readonly #activeSprites = new Set<SpriteEffect>();
  readonly #activeSplashes = new Set<Splash>();
  readonly #activeDebris = new Set<Debris>();
  /** Render-only randomness (debris scatter): never the simulation's RNG. */
  readonly #rng: Rng = createRng(EFFECT_ART.debris.seed);

  constructor(private readonly atlas: Atlas) {
    const hide = (o: { visible: boolean; removeFromParent(): void }) => {
      o.visible = false;
      o.removeFromParent();
    };
    this.#sprites = createPool<SpriteEffect>({
      create: () => {
        const sprite = new Sprite();
        sprite.anchor.set(0.5);
        return { sprite, art: EFFECT_ART.muzzle, age: 0 };
      },
      reset: (e) => {
        hide(e.sprite);
      },
      dispose: (e) => {
        e.sprite.destroy();
      },
    });
    this.#splashes = createPool<Splash>({
      create: () => ({ ring: new Graphics(), age: 0 }),
      reset: (s) => {
        hide(s.ring);
      },
      dispose: (s) => {
        s.ring.destroy();
      },
    });
    this.#debris = createPool<Debris>({
      create: () => {
        const sprite = new Sprite();
        sprite.anchor.set(0.5);
        return { sprite, vx: 0, vy: 0, spin: 0, age: 0 };
      },
      reset: (d) => {
        hide(d.sprite);
      },
      dispose: (d) => {
        d.sprite.destroy();
      },
    });
  }

  play(request: EffectRequest): void {
    switch (request.kind) {
      case 'muzzle':
      case 'hit':
      case 'puff':
      case 'explosion':
        this.#playSprite(
          request.kind,
          request.x,
          request.y,
          request.kind === 'muzzle' ? request.rotation : 0,
        );
        return;
      case 'splash':
        this.#playSplash(request.x, request.y);
        return;
      case 'debris': {
        const count =
          request.amount === 'hit'
            ? EFFECT_ART.debris.countOnHit
            : EFFECT_ART.debris.countOnDestroy;
        for (let i = 0; i < count; i++) this.#playDebris(request.x, request.y);
        return;
      }
      case 'flash':
      case 'shake':
        // Ship flash and camera shake belong to the ship views and the camera.
        return;
    }
  }

  update(dtSeconds: number): void {
    for (const effect of this.#activeSprites) {
      effect.age += dtSeconds;
      const { art } = effect;
      const t = Math.min(1, effect.age / art.seconds);
      if (t >= 1) {
        this.#activeSprites.delete(effect);
        this.#sprites.release(effect);
        continue;
      }
      const frame = art.frames[Math.min(art.frames.length - 1, Math.floor(t * art.frames.length))];
      if (frame !== undefined) effect.sprite.texture = this.atlas.texture(frame);
      effect.sprite.scale.set(art.scaleFrom + (art.scaleTo - art.scaleFrom) * t);
      effect.sprite.alpha = fade(t, art.fadeFrom);
    }
    const splash = EFFECT_ART.splash;
    for (const s of this.#activeSplashes) {
      s.age += dtSeconds;
      const t = Math.min(1, s.age / splash.seconds);
      if (t >= 1) {
        this.#activeSplashes.delete(s);
        this.#splashes.release(s);
        continue;
      }
      drawRing(s.ring, splash.radiusFrom + (splash.radiusTo - splash.radiusFrom) * t);
      s.ring.alpha = splash.alpha * (1 - t);
    }
    const debris = EFFECT_ART.debris;
    for (const d of this.#activeDebris) {
      d.age += dtSeconds;
      const t = Math.min(1, d.age / debris.seconds);
      if (t >= 1) {
        this.#activeDebris.delete(d);
        this.#debris.release(d);
        continue;
      }
      d.sprite.x += d.vx * dtSeconds;
      d.sprite.y += d.vy * dtSeconds;
      d.sprite.rotation += d.spin * dtSeconds;
      d.sprite.alpha = 1 - t;
    }
  }

  get activeEffects(): number {
    return this.#activeSprites.size + this.#activeSplashes.size + this.#activeDebris.size;
  }

  reset(): void {
    for (const e of this.#activeSprites) this.#sprites.release(e);
    for (const s of this.#activeSplashes) this.#splashes.release(s);
    for (const d of this.#activeDebris) this.#debris.release(d);
    this.#activeSprites.clear();
    this.#activeSplashes.clear();
    this.#activeDebris.clear();
  }

  destroy(): void {
    this.reset();
    this.#sprites.destroy();
    this.#splashes.destroy();
    this.#debris.destroy();
    this.view.destroy({ children: true });
  }

  #playSprite(kind: SpriteKind, x: number, y: number, rotation: number): void {
    const effect = this.#sprites.acquire();
    effect.art = EFFECT_ART[kind];
    effect.age = 0;
    const first = effect.art.frames[0];
    if (first !== undefined) effect.sprite.texture = this.atlas.texture(first);
    effect.sprite.position.set(x, y);
    effect.sprite.rotation = rotation;
    effect.sprite.scale.set(effect.art.scaleFrom);
    effect.sprite.alpha = 1;
    effect.sprite.visible = true;
    this.view.addChild(effect.sprite);
    this.#activeSprites.add(effect);
  }

  #playSplash(x: number, y: number): void {
    const splash = this.#splashes.acquire();
    splash.age = 0;
    splash.ring.position.set(x, y);
    drawRing(splash.ring, EFFECT_ART.splash.radiusFrom);
    splash.ring.alpha = EFFECT_ART.splash.alpha;
    splash.ring.visible = true;
    this.view.addChild(splash.ring);
    this.#activeSplashes.add(splash);
  }

  #playDebris(x: number, y: number): void {
    const art = EFFECT_ART.debris;
    const d = this.#debris.acquire();
    const angle = nextFloat(this.#rng) * TAU;
    const speed = nextRange(this.#rng, art.minSpeed, art.maxSpeed);
    const frame = art.frames[Math.floor(nextFloat(this.#rng) * art.frames.length)] ?? art.frames[0];
    d.sprite.texture = this.atlas.texture(frame);
    d.vx = Math.cos(angle) * speed;
    d.vy = Math.sin(angle) * speed;
    d.spin = nextRange(this.#rng, -art.maxSpin, art.maxSpin);
    d.age = 0;
    d.sprite.position.set(x, y);
    d.sprite.rotation = angle;
    d.sprite.scale.set(art.scale);
    d.sprite.alpha = 1;
    d.sprite.visible = true;
    this.view.addChild(d.sprite);
    this.#activeDebris.add(d);
  }
}

/** Redrawn rather than scaled, so the stroke keeps its width as the ring grows. */
function drawRing(ring: Graphics, radius: number): void {
  const { width, color } = EFFECT_ART.splash;
  ring.clear().circle(0, 0, radius).stroke({ width, color });
}

/** Opaque until `fadeFrom` (fraction of the animation), then linear fade to 0. */
function fade(t: number, fadeFrom: number): number {
  if (t <= fadeFrom) return 1;
  return Math.max(0, 1 - (t - fadeFrom) / (1 - fadeFrom));
}
