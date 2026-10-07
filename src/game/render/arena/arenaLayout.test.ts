import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG } from '../../../config/defaults';
import { createRng, nextFloat } from '../../../shared/rng';
import { createMatch } from '../../core';
import { buildArena } from '../../core/map/arena';
import { validateMap } from '../../core/map/validateMap';
import { POCKET_MAP } from '../../core/testing/maps';
import { DECOR, FORT, ISLAND_BLOCK, SHALLOW_TILES } from '../theme';
import type { ArenaGrid, TileLayout } from './arenaLayout';
import {
  islandLayout,
  islandRunLengths,
  layoutShore,
  placeDecor,
  shallowLayout,
  shallowMask,
} from './arenaLayout';

const arena = createMatch(DEFAULT_GAME_CONFIG, 1).arena;
const isIsland = (grid: ArenaGrid, col: number, row: number): boolean =>
  grid.water[row * grid.cols + col] === false;
const tileAt = (layout: TileLayout, col: number, row: number) =>
  layout.tiles.find((t) => t.col === col && t.row === row)?.tile;

describe('islandLayout', () => {
  const layout = islandLayout(arena);

  it('draws exactly the island cells of the collision grid', () => {
    const islandCells = arena.water.filter((water) => !water).length;
    expect(layout.tiles).toHaveLength(islandCells);
    expect(layout.unsupported).toEqual([]);
    for (const { col, row } of layout.tiles) expect(isIsland(arena, col, row)).toBe(true);
  });

  it('keeps every island run exactly 4 long: the only seamless size of the painted island', () => {
    expect(new Set(islandRunLengths(arena))).toEqual(new Set([4]));
  });

  it('draws each 4×4 island with the painted block in order, so neighbours meet as painted', () => {
    // Left island: cols 2–5, rows 2–5.
    ISLAND_BLOCK.tiles.forEach((row, r) => {
      row.forEach((tile, c) => {
        expect(tileAt(layout, 2 + c, 2 + r)).toBe(tile);
      });
    });
    // Top-right island touches the arena border (cols 12–15, rows 0–3): same block.
    expect(tileAt(layout, 12, 0)).toBe(6);
    expect(tileAt(layout, 15, 3)).toBe(57);
  });

  it('indexes longer runs from their shore and uses concave-corner tiles (other maps)', () => {
    const grid = buildArena(POCKET_MAP, 64, 0);
    const pocket = islandLayout(grid);
    expect(pocket.unsupported).toEqual([]);
    // U island top bar (6 wide): 0, 1, 2, 1, 2, 3 along the top row.
    expect([2, 3, 4, 5, 6, 7].map((c) => tileAt(pocket, c, 2))).toEqual([6, 7, 8, 7, 8, 9]);
    expect(tileAt(pocket, 3, 3)).toBe(ISLAND_BLOCK.innerCorner.bottomRight);
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
  it('rings every island with shallow water, with no undrawable cell', () => {
    const layout = shallowLayout(arena);
    expect(layout.unsupported).toEqual([]);
    const mask = shallowMask(arena, 1);
    const inside = (c: number, r: number) => c >= 0 && r >= 0 && c < arena.cols && r < arena.rows;
    for (let row = 0; row < arena.rows; row++) {
      for (let col = 0; col < arena.cols; col++) {
        if (!isIsland(arena, col, row)) continue;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (inside(col + dc, row + dr)) expect(mask(col + dc, row + dr)).toBe(true);
          }
        }
      }
    }
    expect(layout.tiles.every((t) => mask(t.col, t.row))).toBe(true);
    expect(new Set(layout.tiles.map((t) => t.tile))).toContain(SHALLOW_TILES.fill);
  });
});

describe('layoutShore', () => {
  it('reports cells the tileset cannot draw and fills them', () => {
    const strip = (col: number, row: number) => row === 0 && col >= 0 && col < 3;
    const layout = layoutShore(3, 1, strip, SHALLOW_TILES);
    expect(layout.unsupported).toHaveLength(3);
    expect(layout.tiles.every((t) => t.tile === SHALLOW_TILES.fill)).toBe(true);
  });
});

describe('placeDecor', () => {
  const props = placeDecor(arena);
  const cellOf = (p: { x: number; y: number }) => ({
    col: Math.floor(p.x / arena.tileSize),
    row: Math.floor(p.y / arena.tileSize),
  });

  it('is deterministic and has a fort, plants and rocks', () => {
    expect(placeDecor(arena)).toEqual(props);
    const kinds = props.map((p) => p.kind);
    expect(kinds.filter((k) => k === 'fort')).toHaveLength(FORT.pieces.length);
    expect(kinds).toContain('plant');
    expect(kinds).toContain('rock');
    expect(kinds.filter((k) => k === 'plant').length).toBeLessThanOrEqual(DECOR.plants.max);
  });

  it('keeps everything on land, so decoration never looks like an obstacle in the water', () => {
    for (const prop of props) {
      const { col, row } = cellOf(prop);
      expect(isIsland(arena, col, row), `${prop.kind} at ${prop.x},${prop.y}`).toBe(true);
    }
  });

  it('keeps plants and rocks off the fort and apart from each other', () => {
    const fortCells = new Set(
      props.filter((p) => p.kind === 'fort').map((p) => JSON.stringify(cellOf(p))),
    );
    const scattered = props.filter((p) => p.kind !== 'fort');
    for (const p of scattered) expect(fortCells.has(JSON.stringify(cellOf(p)))).toBe(false);
    for (const a of scattered) {
      for (const b of props) {
        if (a !== b) {
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(DECOR.minSpacing);
        }
      }
    }
  });

  it('is decoration only: the collision geometry does not depend on it', () => {
    const again = createMatch(DEFAULT_GAME_CONFIG, 1).arena;
    expect(again.islandRects).toEqual(arena.islandRects);
  });
});
