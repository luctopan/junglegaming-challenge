import { Container, Sprite } from 'pixi.js';
import type { ShipKind } from '../../core';
import type { Atlas } from '../assets/atlas';
import type { Pose } from '../interpolate';
import { HP_BARS, SHIP_ART, SHIP_FX } from '../theme';
import type { ShipState } from '../worldView';
import { HpBar } from './HpBar';
import { hpBarArt, shipFrame, shipStage } from './shipVisual';

const WHITE = 0xffffff;

/**
 * One ship on screen: hull sprite for its damage stage, fire on damaged hulls,
 * a hit flash, the sinking fade of wrecks, and its HP bar (kept in a separate,
 * unrotated layer). Pooled: `bind` re-skins it for a new ship.
 */
export class ShipView {
  /** Rotated body (hull + fires), lives in the ships or wrecks layer. */
  readonly body = new Container();
  readonly bar: HpBar;
  readonly #hull = new Sprite();
  readonly #fires: Sprite[];
  #kind: ShipKind = 'player';
  #frame = '';
  #flashLeft = 0;

  constructor(
    private readonly atlas: Atlas,
    uiAtlas: Atlas,
  ) {
    this.#hull.anchor.set(0.5);
    this.body.addChild(this.#hull);
    this.#fires = SHIP_FX.fires.map(({ x, y }) => {
      const fire = new Sprite(atlas.texture(SHIP_FX.fireFrames[0]));
      fire.anchor.set(0.5);
      fire.position.set(x, y);
      fire.scale.set(SHIP_FX.fireScale);
      this.body.addChild(fire);
      return fire;
    });
    this.bar = new HpBar(uiAtlas);
  }

  bind(kind: ShipKind): void {
    this.#kind = kind;
    this.#frame = '';
    this.#flashLeft = 0;
    this.bar.bind(hpBarArt(kind));
    this.body.visible = true;
    this.bar.view.visible = true;
  }

  flash(): void {
    this.#flashLeft = SHIP_FX.hitFlashSeconds;
  }

  /** Cosmetic animation time; never feeds back into the simulation. */
  animate(dtSeconds: number): void {
    this.#flashLeft = Math.max(0, this.#flashLeft - dtSeconds);
  }

  sync(
    ship: ShipState,
    pose: Pose,
    stageThresholds: readonly number[],
    wreckSeconds: number,
    timeSeconds: number,
  ): void {
    const stage = shipStage(ship.hp, ship.maxHp, stageThresholds);
    const frame = shipFrame(this.#kind, ship.alive ? stage : SHIP_ART.stages - 1);
    if (frame !== this.#frame) {
      this.#frame = frame;
      this.#hull.texture = this.atlas.texture(frame);
    }
    this.body.position.set(pose.x, pose.y);
    this.body.rotation = pose.heading + SHIP_ART.headingOffset;
    this.#hull.tint = this.#flashLeft > 0 ? SHIP_FX.hitFlashTint : WHITE;

    const fireFrame =
      SHIP_FX.fireFrames[
        Math.floor(timeSeconds / SHIP_FX.fireFrameSeconds) % SHIP_FX.fireFrames.length
      ];
    SHIP_FX.fires.forEach(({ minStage }, i) => {
      const fire = this.#fires[i];
      if (fire === undefined) return;
      fire.visible = ship.alive && stage >= minStage;
      if (fire.visible && fireFrame !== undefined) fire.texture = this.atlas.texture(fireFrame);
    });

    if (ship.alive) {
      this.body.alpha = 1;
      this.body.scale.set(1);
      this.bar.view.visible = true;
      this.bar.view.position.set(pose.x, pose.y - HP_BARS.offsetY);
      this.bar.setRatio(ship.hp / ship.maxHp);
    } else {
      // Sinking: fade and shrink over the wreck time; the player's wreck stays readable.
      const left = wreckSeconds > 0 ? Math.max(0, ship.wreckTimeLeft / wreckSeconds) : 0;
      const minAlpha = this.#kind === 'player' ? SHIP_FX.playerWreckMinAlpha : 0;
      this.body.alpha = Math.max(minAlpha, left);
      this.body.scale.set(1 - SHIP_FX.wreckShrink * (1 - left));
      this.bar.view.visible = false;
    }
  }

  reset(): void {
    this.body.visible = false;
    this.bar.view.visible = false;
    this.body.removeFromParent();
    this.bar.view.removeFromParent();
  }

  destroy(): void {
    this.body.destroy({ children: true });
    this.bar.destroy();
  }
}
