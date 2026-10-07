import type { Arena, SolidAt } from '../../core';
import { shoreShape } from '../../core';
import { createRng, nextFloat } from '../../../shared/rng';
import { assertNever } from '../../../shared/assertNever';
import type { ShoreTileset } from '../theme';
import { ARENA_ART, DECOR, GRASS_ISLAND_TILES, SHALLOW_TILES } from '../theme';

/**
 * Pure layout of the arena art, derived from the same grid as the collision
 * rects (`Arena.water`), so what the player sees is what the ships hit.
 */

export type ArenaGrid = Pick<Arena, 'cols' | 'rows' | 'tileSize' | 'water'>;

export interface PlacedTile {
  readonly col: number;
  readonly row: number;
  /** `tile_N` frame of the tile atlas. */
  readonly tile: number;
}

export interface TileLayout {
  readonly tiles: readonly PlacedTile[];
  /** Cells no tile of the set can draw (drawn with a fill tile instead). */
  readonly unsupported: readonly { readonly col: number; readonly row: number }[];
}

export interface Prop {
  readonly x: number;
  readonly y: number;
  readonly tile: number;
  readonly scale: number;
}

const isIslandCell =
  (grid: ArenaGrid): SolidAt =>
  (col, row) =>
    col >= 0 &&
    row >= 0 &&
    col < grid.cols &&
    row < grid.rows &&
    grid.water[row * grid.cols + col] === false;

/** Stable per-cell variety without randomness (same art on every load). */
const pick = (variants: readonly number[], col: number, row: number): number => {
  const CELL_HASH_COL = 31;
  const CELL_HASH_ROW = 17;
  const index = (col * CELL_HASH_COL + row * CELL_HASH_ROW) % variants.length;
  // Tilesets always define at least one variant (see theme.ts).
  return variants[index] ?? variants[0] ?? 0;
};

/** Autotiles every solid cell of `solid` with a rounded shore tile set. */
export function layoutShore(
  cols: number,
  rows: number,
  solid: SolidAt,
  tileset: ShoreTileset,
): TileLayout {
  const tiles: PlacedTile[] = [];
  const unsupported: { col: number; row: number }[] = [];
  const isOuterCorner = (col: number, row: number): boolean =>
    solid(col, row) && shoreShape(solid, col, row).kind === 'outerCorner';

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!solid(col, row)) continue;
      const shape = shoreShape(solid, col, row);
      let tile: number;
      switch (shape.kind) {
        case 'fill':
          tile = pick(tileset.fill, col, row);
          break;
        case 'outerCorner':
          tile = tileset.outerCorner[shape.corner];
          break;
        case 'innerCorner':
          tile = tileset.innerCorner[shape.corner];
          break;
        case 'edge': {
          const edge = tileset.edge[shape.side];
          const horizontal = shape.side === 'top' || shape.side === 'bottom';
          const afterCorner = horizontal
            ? isOuterCorner(col - 1, row)
            : isOuterCorner(col, row - 1);
          tile =
            afterCorner && edge.nextToCorner !== undefined
              ? edge.nextToCorner
              : pick(edge.variants, col, row);
          break;
        }
        case 'unsupported':
          unsupported.push({ col, row });
          tile = pick(tileset.fill, col, row);
          break;
        default:
          return assertNever(shape);
      }
      tiles.push({ col, row, tile });
    }
  }
  return { tiles, unsupported };
}

/** Sand islands with a grass core, one tile per island cell. */
export const islandLayout = (grid: ArenaGrid): TileLayout =>
  layoutShore(grid.cols, grid.rows, isIslandCell(grid), GRASS_ISLAND_TILES);

/**
 * Cells within `ring` tiles (8-neighbourhood) of an island cell, islands
 * included. Rings of nearby islands can meet in shapes the tiles cannot draw
 * (one-tile steps), so such spots are grown until every cell is drawable.
 */
export function shallowMask(grid: ArenaGrid, ring: number): SolidAt {
  const island = isIslandCell(grid);
  const inside = (col: number, row: number): boolean =>
    col >= 0 && row >= 0 && col < grid.cols && row < grid.rows;
  const mask = Array.from({ length: grid.rows * grid.cols }, (_, index) => {
    const col = index % grid.cols;
    const row = Math.floor(index / grid.cols);
    for (let dr = -ring; dr <= ring; dr++) {
      for (let dc = -ring; dc <= ring; dc++) if (island(col + dc, row + dr)) return true;
    }
    return false;
  });
  const solid: SolidAt = (col, row) => inside(col, row) && mask[row * grid.cols + col] === true;

  // Each pass fills the neighbourhood of undrawable cells; the mask only grows, so it terminates.
  for (let pass = 0; pass < grid.rows * grid.cols; pass++) {
    const broken = mask.flatMap((on, index) => {
      const col = index % grid.cols;
      const row = Math.floor(index / grid.cols);
      return on && shoreShape(solid, col, row).kind === 'unsupported' ? [{ col, row }] : [];
    });
    if (broken.length === 0) break;
    for (const { col, row } of broken) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (inside(col + dc, row + dr)) mask[(row + dr) * grid.cols + col + dc] = true;
        }
      }
    }
  }
  return solid;
}

/** Translucent shallow water around (and under) the islands. */
export const shallowLayout = (grid: ArenaGrid): TileLayout =>
  layoutShore(grid.cols, grid.rows, shallowMask(grid, ARENA_ART.shallowRingTiles), SHALLOW_TILES);

/**
 * Plants on grass (grid points shared by four island cells, where the grass
 * strips meet) and rocks on sand (centres of outer-corner cells). Seeded, so the
 * decoration is identical on every load; never part of the collision geometry.
 */
export function placeDecor(grid: ArenaGrid): Prop[] {
  const island = isIslandCell(grid);
  const { tileSize: t } = grid;
  const rng = createRng(DECOR.seed);

  const grassPoints: { x: number; y: number }[] = [];
  for (let row = 1; row < grid.rows; row++) {
    for (let col = 1; col < grid.cols; col++) {
      if (
        island(col - 1, row - 1) &&
        island(col, row - 1) &&
        island(col - 1, row) &&
        island(col, row)
      ) {
        grassPoints.push({ x: col * t, y: row * t });
      }
    }
  }
  const sandPoints: { x: number; y: number }[] = [];
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (island(col, row) && shoreShape(island, col, row).kind === 'outerCorner') {
        sandPoints.push({ x: (col + HALF_TILE) * t, y: (row + HALF_TILE) * t });
      }
    }
  }

  const props: Prop[] = [];
  const farFromOthers = (p: { x: number; y: number }): boolean =>
    props.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= DECOR.minSpacing);
  const scatter = (
    points: { x: number; y: number }[],
    art: { readonly tiles: readonly number[]; readonly scale: number; readonly max: number },
  ): void => {
    let placed = 0;
    for (const point of shuffle(points, () => nextFloat(rng))) {
      if (placed === art.max) return;
      if (!farFromOthers(point)) continue;
      const tile = art.tiles[Math.floor(nextFloat(rng) * art.tiles.length)] ?? art.tiles[0] ?? 0;
      props.push({ x: point.x, y: point.y, tile, scale: art.scale });
      placed++;
    }
  };
  scatter(grassPoints, DECOR.plants);
  scatter(sandPoints, DECOR.rocks);
  return props;
}

const HALF_TILE = 0.5;

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = result[i];
    const b = result[j];
    if (a !== undefined && b !== undefined) {
      result[i] = b;
      result[j] = a;
    }
  }
  return result;
}
