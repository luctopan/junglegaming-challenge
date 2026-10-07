import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG } from '../../../config/defaults';
import { createRng, nextFloat } from '../../../shared/rng';
import { createMatch } from '../../core';
import { validateMap } from '../../core/map/validateMap';
import { buildArena } from '../../core/map/arena';
import { DECOR, GRASS_ISLAND_TILES, SHALLOW_TILES } from '../theme';
import type { ArenaGrid } from './arenaLayout';
import { islandLayout, layoutShore, placeDecor, shallowLayout, shallowMask } from './arenaLayout';

const arena = createMatch(DEFAULT_GAME_CONFIG, 1).arena;
const isIsland = (grid: ArenaGrid, col: number, row: number): boolean =>
  grid.water[row * grid.cols + col] === false;
const tileAt = (layout: ReturnType<typeof islandLayout>, col: number, row: number) =>
  layout.tiles.find((t) => t.col === col && t.row === row)?.tile;

describe('islandLayout', () => {
  const layout = islandLayout(arena);

  it('draws exactly the island cells of the collision grid, all with real shore tiles', () => {
    const islandCells = arena.water.filter((water) => !water).length;
    expect(layout.tiles).toHaveLength(islandCells);
    expect(layout.unsupported).toEqual([]);
    for (const { col, row } of layout.tiles) expect(isIsland(arena, col, row)).toBe(true);
  });

  it('uses corners, edges and concave corners where the U island needs them', () => {
    expect(tileAt(layout, 2, 2)).toBe(GRASS_ISLAND_TILES.outerCorner.topLeft);
    // The first top edge after a corner continues the corner's grass line.
    expect(tileAt(layout, 3, 2)).toBe(GRASS_ISLAND_TILES.edge.top.nextToCorner);
    expect(tileAt(layout, 4, 2)).toBe(8);
    expect(tileAt(layout, 3, 3)).toBe(GRASS_ISLAND_TILES.innerCorner.bottomRight);
    expect(tileAt(layout, 6, 3)).toBe(GRASS_ISLAND_TILES.innerCorner.bottomLeft);
    expect(tileAt(layout, 7, 5)).toBe(GRASS_ISLAND_TILES.outerCorner.bottomRight);
  });

  it('can draw every map that passes validateMap (random layouts)', () => {
    const rng = createRng(2024);
    let checked = 0;
    for (let attempt = 0; attempt < 4000; attempt++) {
      const cells = Array.from({ length: 9 }, () => Array.from('.'.repeat(16)));
      for (let b = 0; b < 4; b++) {
        const col = Math.floor(nextFloat(rng) * 13) + 1;
        const row = Math.floor(nextFloat(rng) * 6) + 1;
        const w = 2 + Math.floor(nextFloat(rng) * 3);
        const h = 2 + Math.floor(nextFloat(rng) * 2);
        for (let r = row; r < Math.min(9, row + h); r++) {
          for (let c = col; c < Math.min(16, col + w); c++) {
            const line = cells[r];
            if (line) line[c] = '#';
          }
        }
      }
      const map = cells.map((line) => line.join(''));
      if (validateMap(map).length > 0) continue;
      checked++;
      const grid = buildArena(map, 64, 0);
      expect(islandLayout(grid).unsupported, map.join('\n')).toEqual([]);
      expect(shallowLayout(grid).unsupported, map.join('\n')).toEqual([]);
    }
    expect(checked).toBeGreaterThan(100);
  });
});

describe('shallowLayout', () => {
  it('rings every island with one tile of shallow water and has no gaps', () => {
    const layout = shallowLayout(arena);
    expect(layout.unsupported).toEqual([]);
    const mask = shallowMask(arena, 1);
    for (let row = 0; row < arena.rows; row++) {
      for (let col = 0; col < arena.cols; col++) {
        if (isIsland(arena, col, row)) {
          for (const [dc, dr] of [
            [-1, -1],
            [1, 1],
            [0, 1],
            [1, 0],
          ] as const) {
            expect(mask(col + dc, row + dr)).toBe(true);
          }
        }
      }
    }
    expect(layout.tiles.every((t) => mask(t.col, t.row))).toBe(true);
    expect(new Set(layout.tiles.map((t) => t.tile))).toContain(SHALLOW_TILES.fill[0]);
  });
});

describe('layoutShore', () => {
  it('reports cells the tileset cannot draw and fills them', () => {
    const strip = (col: number, row: number) => row === 0 && col >= 0 && col < 3;
    const layout = layoutShore(3, 1, strip, SHALLOW_TILES);
    expect(layout.unsupported).toHaveLength(3);
    expect(layout.tiles.every((t) => t.tile === SHALLOW_TILES.fill[0])).toBe(true);
  });
});

describe('placeDecor', () => {
  const props = placeDecor(arena);
  const cellAt = (x: number, y: number) => ({
    col: Math.floor(x / arena.tileSize),
    row: Math.floor(y / arena.tileSize),
  });

  it('places plants and rocks deterministically', () => {
    expect(placeDecor(arena)).toEqual(props);
    expect(props.some((p) => (DECOR.plants.tiles as readonly number[]).includes(p.tile))).toBe(
      true,
    );
    expect(props.some((p) => (DECOR.rocks.tiles as readonly number[]).includes(p.tile))).toBe(true);
  });

  it('keeps every prop on land, so decoration never looks like an obstacle in the water', () => {
    // A plant sits on a grid point: all four cells around it are island.
    for (const prop of props) {
      const { col, row } = cellAt(prop.x, prop.y);
      const onPoint = prop.x % arena.tileSize === 0 && prop.y % arena.tileSize === 0;
      const cells = onPoint
        ? [
            [col - 1, row - 1],
            [col, row - 1],
            [col - 1, row],
            [col, row],
          ]
        : [[col, row]];
      for (const [c = 0, r = 0] of cells)
        expect(isIsland(arena, c, r), `${prop.x},${prop.y}`).toBe(true);
    }
  });

  it('spaces props apart', () => {
    for (const a of props) {
      for (const b of props) {
        if (a !== b)
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(DECOR.minSpacing);
      }
    }
  });

  it('is decoration only: the collision geometry does not depend on it', () => {
    const again = createMatch(DEFAULT_GAME_CONFIG, 1).arena;
    expect(again.islandRects).toEqual(arena.islandRects);
  });
});
