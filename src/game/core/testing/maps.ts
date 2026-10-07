/**
 * Open-water layout for isolated system tests: one 2×2 island at cols 7–8,
 * rows 3–4 (x 448–576, y 192–320); the default player spawn (512, 448) is clear.
 */
/**
 * The Phase 1–2 arena, kept for system tests: a "U" island with a concave
 * pocket (navigation, line of sight) and an L-shaped island with two rects.
 */
export const POCKET_MAP: readonly string[] = [
  '................',
  '................',
  '..######........',
  '..######..##....',
  '..##..##..####..',
  '..##..##..####..',
  '............##..',
  '................',
  '................',
];

export const OPEN_MAP: readonly string[] = [
  '................',
  '................',
  '................',
  '.......##.......',
  '.......##.......',
  '................',
  '................',
  '................',
  '................',
];
