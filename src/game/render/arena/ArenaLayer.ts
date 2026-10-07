import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js';
import type { Atlas } from '../assets/atlas';
import { ARENA_ART } from '../theme';
import type { Viewport } from '../viewport';
import { visibleWorldRect } from '../viewport';
import type { ArenaGrid, TileLayout } from './arenaLayout';
import { islandLayout, placeDecor, shallowLayout } from './arenaLayout';

const tileName = (n: number): string => `tile_${n}`;

/**
 * Static arena art built once per renderer from the collision grid: animated
 * deep water filling the whole screen, the shallow ring, island tiles and
 * decoration. The water beyond the arena is dimmed and the border outlined,
 * so the playable bounds stay readable on any screen shape.
 */
export class ArenaLayer {
  /** Below ships: water, shallow, islands, props, outside dim. */
  readonly view = new Container();
  readonly #water: TilingSprite;
  readonly #outside = new Graphics();
  #drift = { x: 0, y: 0 };
  #visible = { x: 0, y: 0, width: 0, height: 0 };

  constructor(
    atlas: Atlas,
    private readonly grid: ArenaGrid,
  ) {
    this.#water = new TilingSprite({ texture: atlas.texture(tileName(ARENA_ART.waterTile)) });
    const shallow = tileLayer(atlas, shallowLayout(grid), grid.tileSize);
    const islands = tileLayer(atlas, islandLayout(grid), grid.tileSize);
    const props = new Container();
    for (const prop of placeDecor(grid)) {
      const sprite = new Sprite(atlas.texture(tileName(prop.tile)));
      sprite.anchor.set(0.5);
      sprite.position.set(prop.x, prop.y);
      sprite.scale.set(prop.scale);
      props.addChild(sprite);
    }
    this.view.addChild(this.#water, shallow, islands, props, this.#outside);
  }

  /** Covers the whole screen (arena + letterbox) with water and redraws the bounds. */
  setViewport(viewport: Viewport): void {
    const rect = visibleWorldRect(viewport);
    this.#visible = rect;
    this.#water.position.set(rect.x, rect.y);
    this.#water.width = rect.width;
    this.#water.height = rect.height;
    this.#syncWaterOffset();

    const { width, height } = {
      width: this.grid.cols * this.grid.tileSize,
      height: this.grid.rows * this.grid.tileSize,
    };
    const { color, alpha } = ARENA_ART.outsideDim;
    const right = rect.x + rect.width;
    const bottom = rect.y + rect.height;
    this.#outside.clear();
    // Four bands around the arena (any of them may be empty).
    if (rect.y < 0) this.#outside.rect(rect.x, rect.y, rect.width, -rect.y);
    if (bottom > height) this.#outside.rect(rect.x, height, rect.width, bottom - height);
    if (rect.x < 0) this.#outside.rect(rect.x, 0, -rect.x, height);
    if (right > width) this.#outside.rect(width, 0, right - width, height);
    this.#outside.fill({ color, alpha });
    const border = ARENA_ART.border;
    this.#outside
      .rect(0, 0, width, height)
      .stroke({ width: border.width, color: border.color, alpha: border.alpha });
  }

  /** Cosmetic drift of the sea (`dt` from the session clock). */
  animate(dtSeconds: number): void {
    this.#drift = {
      x: this.#drift.x + ARENA_ART.waterDrift.x * dtSeconds,
      y: this.#drift.y + ARENA_ART.waterDrift.y * dtSeconds,
    };
    this.#syncWaterOffset();
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }

  /** Keeps the water pattern anchored to the world origin while the sprite follows the screen. */
  #syncWaterOffset(): void {
    const size = this.grid.tileSize;
    this.#water.tilePosition.set(
      (-this.#visible.x + this.#drift.x) % size,
      (-this.#visible.y + this.#drift.y) % size,
    );
  }
}

function tileLayer(atlas: Atlas, layout: TileLayout, tileSize: number): Container {
  const layer = new Container();
  for (const { col, row, tile } of layout.tiles) {
    const sprite = new Sprite(atlas.texture(tileName(tile)));
    sprite.position.set(col * tileSize, row * tileSize);
    // 2× tiles report their logical (1×) size, so this is a no-op unless the art changes size.
    sprite.setSize(tileSize, tileSize);
    layer.addChild(sprite);
  }
  return layer;
}
