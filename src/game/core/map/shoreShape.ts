/**
 * How a solid cell (island, shallow water…) of a grid mask is drawn with a
 * rounded "shore" tile set: one fill tile, four edges, four outer corners and
 * four inner (concave) corners. Shared by map validation (core) and the tile
 * renderer, so a layout that passes validation is always drawable.
 *
 * Cells outside the grid count as not solid.
 */
export type Side = 'top' | 'right' | 'bottom' | 'left';
export type Corner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

export type ShoreShape =
  | { readonly kind: 'fill' }
  | { readonly kind: 'edge'; readonly side: Side }
  | { readonly kind: 'outerCorner'; readonly corner: Corner }
  /** Concave corner: every neighbour is solid except the diagonal one at `corner`. */
  | { readonly kind: 'innerCorner'; readonly corner: Corner }
  /** Needs a tile the sets do not have (one-wide strip, edge + concave corner…). */
  | { readonly kind: 'unsupported' };

export type SolidAt = (col: number, row: number) => boolean;

const UNSUPPORTED: ShoreShape = { kind: 'unsupported' };

/** Outer corner `corner` needs the diagonal opposite to it to be solid. */
const OUTER_CORNERS: readonly {
  readonly corner: Corner;
  readonly open: readonly [Side, Side];
  readonly solidDiagonal: readonly [number, number];
}[] = [
  { corner: 'topLeft', open: ['top', 'left'], solidDiagonal: [1, 1] },
  { corner: 'topRight', open: ['top', 'right'], solidDiagonal: [-1, 1] },
  { corner: 'bottomLeft', open: ['bottom', 'left'], solidDiagonal: [1, -1] },
  { corner: 'bottomRight', open: ['bottom', 'right'], solidDiagonal: [-1, -1] },
];

/** An edge needs both diagonals on its inner side to be solid. */
const EDGE_DIAGONALS: Readonly<Record<Side, readonly (readonly [number, number])[]>> = {
  top: [
    [-1, 1],
    [1, 1],
  ],
  bottom: [
    [-1, -1],
    [1, -1],
  ],
  left: [
    [1, -1],
    [1, 1],
  ],
  right: [
    [-1, -1],
    [-1, 1],
  ],
};

const DIAGONALS: readonly {
  readonly corner: Corner;
  readonly offset: readonly [number, number];
}[] = [
  { corner: 'topLeft', offset: [-1, -1] },
  { corner: 'topRight', offset: [1, -1] },
  { corner: 'bottomLeft', offset: [-1, 1] },
  { corner: 'bottomRight', offset: [1, 1] },
];

export function shoreShape(solidAt: SolidAt, col: number, row: number): ShoreShape {
  const solid = (dc: number, dr: number): boolean => solidAt(col + dc, row + dr);
  const open: Readonly<Record<Side, boolean>> = {
    top: !solid(0, -1),
    right: !solid(1, 0),
    bottom: !solid(0, 1),
    left: !solid(-1, 0),
  };
  if ((open.top && open.bottom) || (open.left && open.right)) return UNSUPPORTED;

  for (const {
    corner,
    open: [a, b],
    solidDiagonal: [dc, dr],
  } of OUTER_CORNERS) {
    if (open[a] && open[b]) return solid(dc, dr) ? { kind: 'outerCorner', corner } : UNSUPPORTED;
  }
  const openSide = (['top', 'right', 'bottom', 'left'] as const).find((side) => open[side]);
  if (openSide !== undefined) {
    return EDGE_DIAGONALS[openSide].every(([dc, dr]) => solid(dc, dr))
      ? { kind: 'edge', side: openSide }
      : UNSUPPORTED;
  }

  const missing = DIAGONALS.filter(({ offset: [dc, dr] }) => !solid(dc, dr));
  const [only, ...rest] = missing;
  if (only === undefined) return { kind: 'fill' };
  return rest.length === 0 ? { kind: 'innerCorner', corner: only.corner } : UNSUPPORTED;
}
