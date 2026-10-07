import type { Arena, SolidAt } from '../../core';
import { shoreShape } from '../../core';
import { createRng, nextFloat, nextRange } from '../../../shared/rng';
import { HALF } from '../../../shared/math/constants';
import { assertNever } from '../../../shared/assertNever';
import type { ShoreTileset } from '../theme';
import { ARENA_ART, DECOR, FORT, ISLAND_BLOCK, SHALLOW_TILES } from '../theme';

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

/** A decoration sprite, centred on (x, y). Never part of the collision geometry. */
export interface Prop {
  readonly x: number;
  readonly y: number;
  readonly tile: number;
  readonly scale: number;
  readonly kind: 'fort' | 'plant' | 'rock';
}

interface Cell {
  readonly col: number;
  readonly row: number;
}

const isIslandCell =
  (grid: ArenaGrid): SolidAt =>
  (col, row) =>
    col >= 0 &&
    row >= 0 &&
    col < grid.cols &&
    row < grid.rows &&
    grid.water[row * grid.cols + col] === false;

/** Autotiles every solid cell of `solid` with a rounded shore tile set (by cell shape). */
export function layoutShore(
  cols: number,
  rows: number,
  solid: SolidAt,
  tileset: ShoreTileset,
): TileLayout {
  const tiles: PlacedTile[] = [];
  const unsupported: Cell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!solid(col, row)) continue;
      const shape = shoreShape(solid, col, row);
      let tile: number;
      switch (shape.kind) {
        case 'fill':
          tile = tileset.fill;
          break;
        case 'outerCorner':
          tile = tileset.outerCorner[shape.corner];
          break;
        case 'innerCorner':
          tile = tileset.innerCorner[shape.corner];
          break;
        case 'edge':
          tile = tileset.edge[shape.side];
          break;
        case 'unsupported':
          unsupported.push({ col, row });
          tile = tileset.fill;
          break;
        default:
          return assertNever(shape);
      }
      tiles.push({ col, row, tile });
    }
  }
  return { tiles, unsupported };
}

/**
 * Index (0–3) of a cell along its run of solid cells in one direction, in the
 * painted 4×4 island: 0 at the near shore, 3 at the far shore, 1/2 in between
 * (counted from the near shore). A run of exactly 4 maps to 0, 1, 2, 3, which
 * is the only sequence the art draws without seams (DECISIONS R14).
 */
function blockIndex(solid: SolidAt, col: number, row: number, dc: number, dr: number): number {
  const LAST = 3;
  if (!solid(col - dc, row - dr)) return 0;
  if (!solid(col + dc, row + dr)) return LAST;
  let fromShore = 1;
  while (solid(col - dc * (fromShore + 1), row - dr * (fromShore + 1))) fromShore++;
  return 1 + ((fromShore - 1) % 2);
}

/**
 * Sand islands with a grass core. The tiles 6–9 / 22–25 / 38–41 / 54–57 are
 * one painted 4×4 island lit from the top-left: each cell takes the tile at its
 * position along its row and column runs, so neighbours always meet as painted.
 * Concave corners use the "sand clearing" tiles (no painted counterpart).
 */
export function islandLayout(grid: ArenaGrid): TileLayout {
  const solid = isIslandCell(grid);
  const tiles: PlacedTile[] = [];
  const unsupported: Cell[] = [];
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (!solid(col, row)) continue;
      const shape = shoreShape(solid, col, row);
      if (shape.kind === 'unsupported') unsupported.push({ col, row });
      const tile =
        shape.kind === 'innerCorner'
          ? ISLAND_BLOCK.innerCorner[shape.corner]
          : ISLAND_BLOCK.tiles[blockIndex(solid, col, row, 0, 1)]?.[
              blockIndex(solid, col, row, 1, 0)
            ];
      // The block is 4×4 and indices are 0–3, so a tile always exists.
      tiles.push({ col, row, tile: tile ?? ISLAND_BLOCK.tiles[1][1] });
    }
  }
  return { tiles, unsupported };
}

/** Lengths of every horizontal and vertical run of island cells (seamless iff all are 4). */
export function islandRunLengths(grid: ArenaGrid): number[] {
  const solid = isIslandCell(grid);
  const lengths: number[] = [];
  const scan = (outer: number, inner: number, at: (o: number, i: number) => boolean): void => {
    for (let o = 0; o < outer; o++) {
      let run = 0;
      for (let i = 0; i <= inner; i++) {
        if (i < inner && at(o, i)) run++;
        else if (run > 0) {
          lengths.push(run);
          run = 0;
        }
      }
    }
  };
  scan(grid.rows, grid.cols, (row, col) => solid(col, row));
  scan(grid.cols, grid.rows, (col, row) => solid(col, row));
  return lengths;
}

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
 * Decoration, identical on every load (fixed seed) and never part of the
 * collision geometry:
 * - the fort (`FORT`, hand-placed cells on one island),
 * - plants on the grass core (fill cells), rocks on the sand rim (edge cells),
 *   both away from the fort and from each other.
 * Only island cells are used, so nothing looks like an obstacle in the water.
 */
export function placeDecor(grid: ArenaGrid): Prop[] {
  const island = isIslandCell(grid);
  const { tileSize: t } = grid;
  const rng = createRng(DECOR.seed);
  const centre = (c: Cell): { x: number; y: number } => ({
    x: (c.col + HALF) * t,
    y: (c.row + HALF) * t,
  });

  const props: Prop[] = FORT.pieces
    .filter((p) => island(FORT.anchor.col + p.dc, FORT.anchor.row + p.dr))
    .map((p) => ({
      ...centre({ col: FORT.anchor.col + p.dc, row: FORT.anchor.row + p.dr }),
      tile: p.tile,
      scale: 1,
      kind: 'fort' as const,
    }));
  const fortCells = new Set(props.map((p) => `${Math.floor(p.x / t)},${Math.floor(p.y / t)}`));

  const cells = (kind: 'fill' | 'edge'): Cell[] => {
    const found: Cell[] = [];
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        if (!island(col, row) || fortCells.has(`${col},${row}`)) continue;
        if (shoreShape(island, col, row).kind === kind) found.push({ col, row });
      }
    }
    return found;
  };

  const farFromOthers = (p: { x: number; y: number }): boolean =>
    props.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= DECOR.minSpacing);
  const scatter = (
    candidates: Cell[],
    art: (typeof DECOR)['plants'] | (typeof DECOR)['rocks'],
    kind: 'plant' | 'rock',
  ): void => {
    let placed = 0;
    for (const cell of shuffle(candidates, () => nextFloat(rng))) {
      if (placed === art.max) return;
      const c = centre(cell);
      const point = {
        x: c.x + nextRange(rng, -art.jitter, art.jitter),
        y: c.y + nextRange(rng, -art.jitter, art.jitter),
      };
      if (!farFromOthers(point)) continue;
      const tile = art.tiles[Math.floor(nextFloat(rng) * art.tiles.length)] ?? art.tiles[0];
      props.push({ ...point, tile, scale: art.scale, kind });
      placed++;
    }
  };
  scatter(cells('fill'), DECOR.plants, 'plant');
  scatter(cells('edge'), DECOR.rocks, 'rock');
  return props;
}

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
