import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { trackResource } from '../../../platform/resourceCounters';
import type { Atlas, FillLayout } from '../assets/atlas';
import type { HpBarArt } from '../theme';
import { hpBarPixels, hpFill } from './shipVisual';

/**
 * HP bar from the UI atlas: frame sprite, then the fill sprite clipped
 * horizontally from the left (`ui.layout.fill_rect`, clip_axis x, origin left).
 * Clipping shrinks the frame of a texture owned by this bar (no mask, so all
 * bars still batch into one draw call); it only changes when the visible
 * width in pixels changes.
 */
export class HpBar {
  readonly view = new Container();
  readonly #frame = new Sprite();
  readonly #fill = new Sprite();
  /**
   * Private texture over the shared atlas source; its frame is the clip. Created
   * with an explicit frame, otherwise `update()` would reset it to the whole source.
   */
  readonly #clip = new Texture({
    source: Texture.EMPTY.source,
    frame: new Rectangle(0, 0, 1, 1),
    // A separate rectangle: without it `orig` would alias `frame`.
    orig: new Rectangle(0, 0, 1, 1),
  });
  readonly #releaseTexture = trackResource('dynamicTextures');
  #art: HpBarArt | null = null;
  #layout: FillLayout | null = null;
  #fillFrame = '';
  #pixels = -1;

  constructor(private readonly atlas: Atlas) {
    this.view.addChild(this.#frame, this.#fill);
    this.#fill.texture = this.#clip;
  }

  /** Re-skins the bar for a ship kind (pooled bars switch between player and enemy art). */
  bind(art: HpBarArt): void {
    if (this.#art === art) return;
    this.#art = art;
    this.#layout = this.atlas.fillLayout(art.frame);
    const frame = this.atlas.texture(art.frame);
    this.#frame.texture = frame;
    this.view.pivot.set(frame.width / 2, frame.height / 2);
    this.view.scale.set(art.scale);
    this.#fillFrame = '';
    this.#pixels = -1;
  }

  /** `ratio` = hp / maxHp. */
  setRatio(ratio: number): void {
    const art = this.#art;
    const layout = this.#layout;
    if (art === null || layout === null) return;
    const fill = hpFill(art, ratio);
    const pixels = hpBarPixels(ratio, layout.fillRect.w);
    if (fill.frame === this.#fillFrame && pixels === this.#pixels) return;
    this.#fillFrame = fill.frame;
    this.#pixels = pixels;

    const source = this.atlas.texture(fill.frame);
    const width = layout.fillRect.x + pixels;
    this.#clip.source = source.source;
    this.#clip.frame.copyFrom(source.frame);
    this.#clip.frame.width = width;
    this.#clip.orig.copyFrom(source.orig);
    this.#clip.orig.width = width;
    this.#clip.update();
    this.#fill.visible = pixels > 0;
  }

  destroy(): void {
    this.view.destroy({ children: true });
    // The clip shares the atlas source, which stays cached: destroy only the view of it.
    this.#clip.destroy(false);
    this.#releaseTexture();
  }
}
