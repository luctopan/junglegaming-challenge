import type { Vec2 } from '../../../shared/math/vec2';
import { HALF } from '../../../shared/math/constants';
import type { Rect } from '../geometry';
import type { Arena } from '../types';
import { ISLAND } from './arenaMap';

interface Run {
  readonly col0: number;
  readonly col1: number; // exclusive
}

interface CellRect {
  readonly col0: number;
  readonly col1: number; // exclusive
  readonly row0: number;
  row1: number; // exclusive
}

/** Island cells → few rectangles: horizontal runs per row, then identical runs merged downwards. */
function mergeIslandCells(map: readonly string[]): CellRect[] {
  const done: CellRect[] = [];
  let open: CellRect[] = [];
  map.forEach((line, row) => {
    const runs = islandRuns(line);
    const next: CellRect[] = [];
    for (const run of runs) {
      const extended = open.find((r) => r.col0 === run.col0 && r.col1 === run.col1);
      if (extended) {
        extended.row1 = row + 1;
        next.push(extended);
      } else {
        next.push({ ...run, row0: row, row1: row + 1 });
      }
    }
    done.push(...open.filter((r) => !next.includes(r)));
    open = next;
  });
  return [...done, ...open];
}

function islandRuns(line: string): Run[] {
  const runs: Run[] = [];
  let start = -1;
  for (let col = 0; col <= line.length; col++) {
    const island = line[col] === ISLAND;
    if (island && start < 0) start = col;
    if (!island && start >= 0) {
      runs.push({ col0: start, col1: col });
      start = -1;
    }
  }
  return runs;
}

/**
 * Builds the static arena. `inset` shrinks each rect side whose neighbouring
 * cells are all water, so collision can follow rounded shore art without
 * opening gaps where two rects of the same island touch.
 */
export function buildArena(map: readonly string[], tileSize: number, inset: number): Arena {
  const rows = map.length;
  const cols = map[0]?.length ?? 0;
  const water = map.flatMap((line) => Array.from(line, (ch) => ch !== ISLAND));
  const isWater = (col: number, row: number): boolean =>
    col < 0 || row < 0 || col >= cols || row >= rows ? false : (water[row * cols + col] ?? false);
  const sideIsShore = (cells: readonly [number, number][]): boolean =>
    cells.every(([col, row]) => isWater(col, row));
  const span = (from: number, to: number): number[] =>
    Array.from({ length: to - from }, (_, i) => from + i);

  const islandRects = mergeIslandCells(map).map((r): Rect => {
    const above = span(r.col0, r.col1).map((col): [number, number] => [col, r.row0 - 1]);
    const below = span(r.col0, r.col1).map((col): [number, number] => [col, r.row1]);
    const left = span(r.row0, r.row1).map((row): [number, number] => [r.col0 - 1, row]);
    const right = span(r.row0, r.row1).map((row): [number, number] => [r.col1, row]);
    return {
      minX: r.col0 * tileSize + (sideIsShore(left) ? inset : 0),
      maxX: r.col1 * tileSize - (sideIsShore(right) ? inset : 0),
      minY: r.row0 * tileSize + (sideIsShore(above) ? inset : 0),
      maxY: r.row1 * tileSize - (sideIsShore(below) ? inset : 0),
    };
  });

  return {
    cols,
    rows,
    tileSize,
    width: cols * tileSize,
    height: rows * tileSize,
    water,
    islandRects,
  };
}

/** Index of the cell containing `pos` (clamped to the grid). */
export function cellIndexAt(arena: Arena, pos: Vec2): number {
  const col = Math.min(arena.cols - 1, Math.max(0, Math.floor(pos.x / arena.tileSize)));
  const row = Math.min(arena.rows - 1, Math.max(0, Math.floor(pos.y / arena.tileSize)));
  return row * arena.cols + col;
}

export const cellCenter = (arena: Arena, index: number): Vec2 => ({
  x: ((index % arena.cols) + HALF) * arena.tileSize,
  y: (Math.floor(index / arena.cols) + HALF) * arena.tileSize,
});

export const isWaterCell = (arena: Arena, col: number, row: number): boolean =>
  col >= 0 &&
  row >= 0 &&
  col < arena.cols &&
  row < arena.rows &&
  (arena.water[row * arena.cols + col] ?? false);
