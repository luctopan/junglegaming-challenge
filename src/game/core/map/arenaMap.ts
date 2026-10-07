/**
 * Hand-authored arena layout: 16×9 tiles, `.` = water, `#` = island.
 * Collision rects (game/core) and island tiles (game/render) both come from
 * this grid, so art and collision always match.
 *
 * Constraints (checked by `validateMap`, see map.test.ts): every island cell is
 * part of a 2×2 island block and maps to exactly one shore tile (`shoreShape`), every
 * water cell is part of a 2×2 water block (channels ≥ 2 tiles wide), no
 * diagonal-only contacts, all water connected. The "U" island has a concave
 * pocket that exercises enemy navigation.
 */
export const ARENA_MAP: readonly string[] = Object.freeze([
  '................',
  '................',
  '..######........',
  '..######..##....',
  '..##..##..####..',
  '..##..##..####..',
  '............##..',
  '................',
  '................',
]);

export const WATER = '.';
export const ISLAND = '#';
