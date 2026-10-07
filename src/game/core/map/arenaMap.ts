/**
 * Hand-authored arena layout: 16×9 tiles, `.` = water, `#` = island.
 * Collision rects (game/core) and island tiles (game/render) both come from
 * this grid, so art and collision always match.
 *
 * Constraints (checked by `validateMap`, see map.test.ts): every island cell is
 * part of a 2×2 island block and maps to exactly one shore tile (`shoreShape`),
 * every water cell is part of a 2×2 water block (channels ≥ 2 tiles wide), no
 * diagonal-only contacts, all water connected.
 *
 * Three 4×4 islands, the only size the delivered grass-island art draws without
 * seams (its tiles form one painted 4×4 island; DECISIONS R14): a fort island
 * on the left, one in the top-right corner and one on the bottom edge, leaving
 * the middle open for combat. The player starts in the open water between them.
 */
export const ARENA_MAP: readonly string[] = Object.freeze([
  '............####',
  '............####',
  '..####......####',
  '..####......####',
  '..####..........',
  '..####..####....',
  '........####....',
  '........####....',
  '........####....',
]);

export const WATER = '.';
export const ISLAND = '#';
