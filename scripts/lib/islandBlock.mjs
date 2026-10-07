// @ts-check
/**
 * The painted 4×4 grass island (same as ISLAND_BLOCK in src/game/render/theme.ts,
 * checked by tests/tooling/atlas.test.ts). The game always draws these tiles
 * next to each other in this order, so the small colour steps the painting has
 * along some of their shared borders are healed at build time (DECISIONS R14).
 */
export const ISLAND_BLOCK = [
  [6, 7, 8, 9],
  [22, 23, 24, 25],
  [38, 39, 40, 41],
  [54, 55, 56, 57],
];

/** Every pair of neighbouring tiles inside the island block. */
export const ISLAND_BLOCK_SEAMS = ISLAND_BLOCK.flatMap((row, r) =>
  row.flatMap((tile, c) => [
    ...(c < row.length - 1
      ? [{ a: tile, b: row[c + 1] ?? tile, axis: /** @type {const} */ ('x') }]
      : []),
    ...(r < ISLAND_BLOCK.length - 1
      ? [{ a: tile, b: ISLAND_BLOCK[r + 1]?.[c] ?? tile, axis: /** @type {const} */ ('y') }]
      : []),
  ]),
);
