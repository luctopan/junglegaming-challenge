import { describe, expect, it } from 'vitest';
import type { ShoreShape } from './shoreShape';
import { shoreShape } from './shoreShape';

/** Parses a small `#`/`.` grid into a solid predicate (outside = not solid). */
const solidOf =
  (grid: readonly string[]) =>
  (col: number, row: number): boolean =>
    grid[row]?.[col] === '#';

const shapeAt = (grid: readonly string[], col: number, row: number): ShoreShape =>
  shoreShape(solidOf(grid), col, row);

describe('shoreShape', () => {
  const square = ['....', '.##.', '.##.', '....'];
  const big = ['.....', '.###.', '.###.', '.###.', '.....'];

  it('classifies the outer corners of a 2×2 block', () => {
    expect(shapeAt(square, 1, 1)).toEqual({ kind: 'outerCorner', corner: 'topLeft' });
    expect(shapeAt(square, 2, 1)).toEqual({ kind: 'outerCorner', corner: 'topRight' });
    expect(shapeAt(square, 1, 2)).toEqual({ kind: 'outerCorner', corner: 'bottomLeft' });
    expect(shapeAt(square, 2, 2)).toEqual({ kind: 'outerCorner', corner: 'bottomRight' });
  });

  it('classifies edges and the fill of a 3×3 block', () => {
    expect(shapeAt(big, 2, 1)).toEqual({ kind: 'edge', side: 'top' });
    expect(shapeAt(big, 3, 2)).toEqual({ kind: 'edge', side: 'right' });
    expect(shapeAt(big, 2, 3)).toEqual({ kind: 'edge', side: 'bottom' });
    expect(shapeAt(big, 1, 2)).toEqual({ kind: 'edge', side: 'left' });
    expect(shapeAt(big, 2, 2)).toEqual({ kind: 'fill' });
  });

  it('classifies concave corners by their missing diagonal', () => {
    const l = ['....', '.##.', '.###', '.###'];
    // (2,2) has every neighbour but the top-right diagonal (3,1).
    expect(shapeAt(l, 2, 2)).toEqual({ kind: 'innerCorner', corner: 'topRight' });
  });

  it.each([
    ['one-wide horizontal strip', ['....', '###.', '....'], 1, 1],
    ['one-wide vertical strip', ['.#.', '.#.', '.#.'], 1, 1],
    // Staircase joint: a bottom edge that would also need a concave corner.
    ['edge with a concave corner', ['##..', '####', '..##'], 1, 1],
    ['outer corner without its inner diagonal', ['##.', '#..', '...'], 0, 0],
    ['two missing diagonals', ['.#.', '###', '.#.'], 1, 1],
  ])('rejects a %s', (_name, grid, col, row) => {
    expect(shapeAt(grid, col, row)).toEqual({ kind: 'unsupported' });
  });
});
