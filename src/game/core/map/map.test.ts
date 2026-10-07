import { describe, expect, it } from 'vitest';
import { SQUARE_CORNERS } from '../geometry';
import { POCKET_MAP } from '../testing/maps';
import { buildArena, cellCenter, cellIndexAt } from './arena';
import { ARENA_MAP } from './arenaMap';
import { validateMap } from './validateMap';

const blank = (): string[] => Array.from({ length: 9 }, () => '.'.repeat(16));
const withIslands = (cells: [number, number][]): string[] => {
  const rows = blank().map((r) => Array.from(r));
  for (const [col, row] of cells) {
    const line = rows[row];
    if (line) line[col] = '#';
  }
  return rows.map((r) => r.join(''));
};
const block = (col: number, row: number): [number, number][] => [
  [col, row],
  [col + 1, row],
  [col, row + 1],
  [col + 1, row + 1],
];

describe('ARENA_MAP', () => {
  it('satisfies every layout constraint', () => {
    expect(validateMap(ARENA_MAP)).toEqual([]);
  });

  it('is 16×9 tiles with at least one island', () => {
    expect(ARENA_MAP).toHaveLength(9);
    expect(ARENA_MAP.every((row) => row.length === 16)).toBe(true);
    expect(ARENA_MAP.join('')).toContain('#');
  });
});

describe('validateMap', () => {
  it('accepts a single 2×2 island in open water', () => {
    expect(validateMap(withIslands(block(6, 3)))).toEqual([]);
  });

  it('rejects single-cell and one-wide island pieces', () => {
    expect(validateMap(withIslands([[6, 3]]))).toContainEqual(
      expect.stringMatching(/island cell \(6,3\) is not part of a 2×2 island block/),
    );
    expect(validateMap(withIslands([...block(6, 3), [8, 3]])).join()).toMatch(/\(8,3\)/);
  });

  it('rejects channels narrower than two tiles', () => {
    const issues = validateMap(withIslands([...block(2, 3), ...block(5, 3)]));
    expect(issues).toContainEqual(expect.stringMatching(/water cell \(4,3\) is in a channel/));
  });

  it('rejects diagonal-only contacts', () => {
    const issues = validateMap(withIslands([...block(2, 2), ...block(4, 4)]));
    expect(issues).toContainEqual(expect.stringMatching(/diagonal-only contact/));
  });

  it('rejects shapes the shore tiles cannot draw (one-tile staircase joints)', () => {
    // Two 2×2 blocks joined along a single tile edge: (7,4) would need a bottom
    // edge and a concave corner in one tile.
    const issues = validateMap(withIslands([...block(6, 3), ...block(8, 4)]));
    expect(issues).toContainEqual(
      expect.stringMatching(/island cell \(7,4\) cannot be drawn with the shore tiles/),
    );
  });

  it('rejects disconnected water', () => {
    const ring: [number, number][] = [];
    for (let c = 4; c <= 9; c++) ring.push([c, 1], [c, 2], [c, 7], [c, 8]);
    for (let r = 3; r <= 6; r++) ring.push([4, r], [5, r], [8, r], [9, r]);
    // An enclosed 2×4 lagoon at cols 6–7, rows 3–6.
    expect(validateMap(withIslands(ring))).toContain('water cells are not all connected');
  });

  it('rejects malformed maps', () => {
    expect(validateMap([])).toEqual(['map is empty']);
    expect(validateMap(['....', '...'])).toContainEqual(expect.stringMatching(/row 1 has 3/));
    expect(validateMap(['..x.', '....'])).toContainEqual(expect.stringMatching(/unknown cell/));
    expect(validateMap(blank())).toContain('map has no island');
  });
});

describe('buildArena', () => {
  it('derives size and merges island cells into rectangles', () => {
    const arena = buildArena(ARENA_MAP, 64, 0);
    expect(arena.width).toBe(1024);
    expect(arena.height).toBe(576);
    expect(arena.water.filter((w) => !w)).toHaveLength(ARENA_MAP.join('').split('#').length - 1);
    // Left island: cols 2–5, rows 2–5, one rect.
    expect(arena.islandRects).toContainEqual({
      minX: 128,
      minY: 128,
      maxX: 384,
      maxY: 384,
      radii: SQUARE_CORNERS,
    });
    const area = arena.islandRects.reduce((s, r) => s + (r.maxX - r.minX) * (r.maxY - r.minY), 0);
    expect(area).toBe(arena.water.filter((w) => !w).length * 64 * 64);
  });

  it('insets only the sides that face water', () => {
    const map = withIslands([...block(6, 3), [8, 3], [9, 3], [8, 4], [9, 4]]);
    // One 4×2 island merged into a single rect: every side faces water.
    expect(buildArena(map, 64, 8, 30).islandRects).toEqual([
      {
        minX: 6 * 64 + 8,
        maxX: 10 * 64 - 8,
        minY: 3 * 64 + 8,
        maxY: 5 * 64 - 8,
        // …and every corner is a convex shore corner, so all four are rounded.
        radii: { topLeft: 30, topRight: 30, bottomLeft: 30, bottomRight: 30 },
      },
    ]);
    // Two rects of the same island: the shared edge is not inset (no gap opens).
    const arena = buildArena(POCKET_MAP, 64, 8);
    const bar = arena.islandRects.find((r) => r.minY === 128 + 8);
    const leftArm = arena.islandRects.find((r) => r.minX === 128 + 8 && r.minY === 256);
    expect(bar?.maxY).toBe(256 - 0);
    expect(leftArm).toBeDefined();
  });

  it('maps positions to cells and back', () => {
    const arena = buildArena(ARENA_MAP, 64, 0);
    expect(cellIndexAt(arena, { x: 70, y: 130 })).toBe(2 * 16 + 1);
    expect(cellIndexAt(arena, { x: -5, y: 9999 })).toBe(8 * 16);
    expect(cellCenter(arena, 2 * 16 + 1)).toEqual({ x: 96, y: 160 });
  });
});
