import type { Corner, ShipKind, Side } from '../core';

/**
 * Visual constants of the arena renderer: which atlas frames to draw, effect
 * timings and sizes. Gameplay balancing never lives here (see config/), only
 * presentation, so tuning the look never changes the rules.
 *
 * Units: world units (u, 1 u = 1 px of the 1× art), seconds, radians.
 */

/** `ship_N` with N = colour + SHIP_COLOURS × damage stage (docs/ASSETS.md). */
export const SHIP_ART = {
  colours: 6,
  /** Damage stages available in the atlas (0 intact … 3 wreck). */
  stages: 4,
  colour: { player: 5, chaser: 2, shooter: 3 } satisfies Record<ShipKind, number>,
  /** Sprites point up; headings point along +x. */
  headingOffset: Math.PI / 2,
} as const;

/** A rounded tile set, chosen per cell by `shoreShape` (core map module). */
export interface ShoreTileset {
  readonly fill: number;
  readonly edge: Readonly<Record<Side, number>>;
  readonly outerCorner: Readonly<Record<Corner, number>>;
  readonly innerCorner: Readonly<Record<Corner, number>>;
}

/**
 * Sand islands with a grass core: tiles 6–9 / 22–25 / 38–41 / 54–57 are ONE
 * painted 4×4 island, lit from the top-left. Inside it neighbours meet with a
 * colour step of 1–3 (0–255 scale); any other neighbour pair (a tile next to
 * itself, a skipped row…) steps 10–60, which reads as a tile grid
 * (DECISIONS R14). `tiles[row][col]` is indexed by the cell's position in its
 * runs (`islandLayout`). The "sand clearing" tiles 36/37/52/53 serve as concave
 * corners (no painted counterpart).
 */
export const ISLAND_BLOCK = {
  tiles: [
    [6, 7, 8, 9],
    [22, 23, 24, 25],
    [38, 39, 40, 41],
    [54, 55, 56, 57],
  ],
  innerCorner: { topLeft: 53, topRight: 52, bottomLeft: 37, bottomRight: 36 },
} as const satisfies {
  tiles: readonly (readonly number[])[];
  innerCorner: Readonly<Record<Corner, number>>;
};

/** Translucent shallow-water ring (tiles 10–12 / 26–28 / 42–44, concave 58/59/74/75). */
export const SHALLOW_TILES: ShoreTileset = {
  fill: 27,
  edge: { top: 11, left: 26, right: 28, bottom: 43 },
  outerCorner: { topLeft: 10, topRight: 12, bottomLeft: 42, bottomRight: 44 },
  innerCorner: { topLeft: 75, topRight: 74, bottomLeft: 59, bottomRight: 58 },
};

export const ARENA_ART = {
  waterTile: 73,
  /** Shallow water reaches this many tiles around every island cell. */
  shallowRingTiles: 1,
  /** Slow drift of the water texture, for a living sea (u/s). */
  waterDrift: { x: 6, y: 3 },
  /** Water outside the playable arena is darkened so its bounds stay readable. */
  outsideDim: { color: 0x0b2a3a, alpha: 0.45 },
  border: { color: 0xffffff, alpha: 0.25, width: 2 },
} as const;

/**
 * Props are decoration only: they never take part in collisions. Density
 * follows the mockup (a few plants and a rock or two per island).
 */
export const DECOR = {
  seed: 0x5eed,
  /** On the grass core; `jitter` = max offset from the cell centre (u). */
  plants: { tiles: [70, 71, 72, 87, 88], scale: 0.8, max: 7, jitter: 14 },
  /** On the sand rim. */
  rocks: { tiles: [49, 50, 51, 65, 66, 67], scale: 0.75, max: 4, jitter: 10 },
  /** Props keep at least this distance from each other and from the fort (u). */
  minSpacing: 56,
} as const;

/**
 * Stone fort on the left island (ARENA_MAP cols 2–5, rows 2–5), drawn from the
 * fort tiles: a tower linked east to a cannon wall, a bridge and a second tower,
 * with a short wall south. Pieces outside the island are skipped (tested).
 * Tiles by connected sides: 77 tower E+S, 62 tower W, 47 wall E–W with cannon,
 * 76 bridge E–W, 79 wall end N.
 */
export const FORT = {
  anchor: { col: 2, row: 3 },
  pieces: [
    { dc: 0, dr: 0, tile: 77 },
    { dc: 1, dr: 0, tile: 47 },
    { dc: 2, dr: 0, tile: 76 },
    { dc: 3, dr: 0, tile: 62 },
    { dc: 0, dr: 1, tile: 79 },
  ],
} as const;

/** Colour of an HP fill, shared with the HUD so both bars change colour together. */
export type HpTone = 'green' | 'amber' | 'red';

export interface BarFill {
  readonly frame: string;
  readonly tone: HpTone;
  /** Used while hp / maxHp > minRatio (fills are checked in order). */
  readonly minRatio: number;
}

export interface HpBarArt {
  readonly frame: string;
  readonly fills: readonly BarFill[];
  readonly scale: number;
}

/** HP bars over ships, from the UI atlas (fill clipped by its `ui.layout.fill_rect`). */
export const HP_BARS = {
  /** Bar centre above the ship centre (u): clears the hull at any rotation. */
  offsetY: 66,
  player: {
    frame: 'health_frame',
    fills: [
      { frame: 'health_fill_green', tone: 'green', minRatio: 0.5 },
      { frame: 'health_fill_amber', tone: 'amber', minRatio: 0.25 },
      { frame: 'health_fill_red', tone: 'red', minRatio: 0 },
    ],
    scale: 0.3,
  },
  enemy: {
    frame: 'enemy_health_frame',
    // Always red, as in the mockup: enemies read apart from the player at a glance.
    fills: [{ frame: 'enemy_health_fill_red', tone: 'red', minRatio: 0 }],
    scale: 0.4,
  },
} as const satisfies { offsetY: number; player: HpBarArt; enemy: HpBarArt };

export const SHIP_FX = {
  /** Fire sprites on damaged hulls, in ship-local coordinates (sprite pointing up). */
  fires: [
    { x: -9, y: 10, minStage: 1 },
    { x: 11, y: -14, minStage: 2 },
  ],
  fireFrames: ['fire_1', 'fire_2'],
  fireFrameSeconds: 0.12,
  fireScale: 0.9,
  hitFlashSeconds: 0.15,
  hitFlashTint: 0xff7a6a,
  /** Wrecks fade while sinking; the player's wreck stays visible at this alpha. */
  playerWreckMinAlpha: 0.6,
  wreckShrink: 0.15,
} as const;

export const PROJECTILE_ART = {
  frame: 'cannon_ball',
  /**
   * White streak behind each ball (mockup), fading from `alpha` at the ball to 0
   * at the tail; it grows from the muzzle up to `maxLength` (u).
   */
  trail: { maxLength: 72, width: 4, color: 0xffffff, alpha: 0.8, gradientSteps: 32 },
} as const;

export interface SpriteEffectArt {
  /** Frames played in order over `seconds`. */
  readonly frames: readonly string[];
  readonly seconds: number;
  readonly scaleFrom: number;
  readonly scaleTo: number;
  /** Fraction of `seconds` after which the effect fades out. */
  readonly fadeFrom: number;
}

/** Short, pooled effects; all well under a second so the arena stays readable. */
export const EFFECT_ART = {
  muzzle: {
    frames: ['explosion_3'],
    seconds: 0.16,
    scaleFrom: 0.3,
    scaleTo: 0.55,
    fadeFrom: 0.3,
  },
  hit: {
    frames: ['explosion_3', 'explosion_2'],
    seconds: 0.3,
    scaleFrom: 0.35,
    scaleTo: 0.7,
    fadeFrom: 0.5,
  },
  /** A ball hitting the shore. */
  puff: { frames: ['explosion_3'], seconds: 0.22, scaleFrom: 0.2, scaleTo: 0.4, fadeFrom: 0.2 },
  explosion: {
    frames: ['explosion_3', 'explosion_2', 'explosion_1'],
    seconds: 0.65,
    scaleFrom: 0.7,
    scaleTo: 1.3,
    fadeFrom: 0.6,
  },
  splash: { seconds: 0.4, radiusFrom: 3, radiusTo: 16, color: 0xffffff, alpha: 0.8, width: 2 },
  debris: {
    frames: ['wood_1', 'wood_2', 'wood_3', 'wood_4'],
    countOnHit: 2,
    countOnDestroy: 5,
    seconds: 0.55,
    minSpeed: 50,
    maxSpeed: 140,
    maxSpin: 8,
    scale: 0.7,
    seed: 0xdeb12,
  },
} as const satisfies {
  muzzle: SpriteEffectArt;
  hit: SpriteEffectArt;
  puff: SpriteEffectArt;
  explosion: SpriteEffectArt;
  splash: object;
  debris: object;
};

export const CAMERA_SHAKE = {
  /** Shake on player damage: amplitude (u) decays linearly over `seconds`. */
  amplitude: 5,
  seconds: 0.25,
  /** Wobble speed (rad/s); y runs at a different rate so the shake is not a straight line. */
  frequency: 60,
  yFrequencyRatio: 0.7,
} as const;
