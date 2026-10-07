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

export interface ShoreEdge {
  readonly variants: readonly number[];
  /** Tile that continues the grass line of the outer corner before it (left/above). */
  readonly nextToCorner?: number;
}

/** A rounded tile set: see `shoreShape` in the core map module. */
export interface ShoreTileset {
  readonly fill: readonly number[];
  readonly edge: Readonly<Record<Side, ShoreEdge>>;
  readonly outerCorner: Readonly<Record<Corner, number>>;
  readonly innerCorner: Readonly<Record<Corner, number>>;
}

/**
 * Sand islands with a grass core (tiles 6–9 / 22–25 / 38–41 / 54–57). The
 * "sand clearing" tiles 36/37/52/53 double as concave corners: their borders
 * line up with the edge tiles (checked pixel by pixel when this set was chosen).
 */
export const GRASS_ISLAND_TILES: ShoreTileset = {
  fill: [23, 39, 40],
  edge: {
    top: { variants: [8], nextToCorner: 7 },
    left: { variants: [38], nextToCorner: 22 },
    right: { variants: [25, 41] },
    bottom: { variants: [55, 56] },
  },
  outerCorner: { topLeft: 6, topRight: 9, bottomLeft: 54, bottomRight: 57 },
  innerCorner: { topLeft: 53, topRight: 52, bottomLeft: 37, bottomRight: 36 },
};

/** Translucent shallow-water ring (tiles 10–12 / 26–28 / 42–44, concave 58/59/74/75). */
export const SHALLOW_TILES: ShoreTileset = {
  fill: [27],
  edge: {
    top: { variants: [11] },
    left: { variants: [26] },
    right: { variants: [28] },
    bottom: { variants: [43] },
  },
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

/** Props are decoration only: they never take part in collisions. */
export const DECOR = {
  seed: 0x5eed,
  plants: { tiles: [70, 71, 72, 87, 88], scale: 0.75, max: 6 },
  rocks: { tiles: [49, 50, 51, 65, 66, 67], scale: 0.7, max: 3 },
  /** Props keep at least this distance from each other (u). */
  minSpacing: 70,
} as const;

export interface BarFill {
  readonly frame: string;
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
      { frame: 'health_fill_green', minRatio: 0.5 },
      { frame: 'health_fill_amber', minRatio: 0.25 },
      { frame: 'health_fill_red', minRatio: 0 },
    ],
    scale: 0.3,
  },
  enemy: {
    frame: 'enemy_health_frame',
    fills: [
      { frame: 'enemy_health_fill_green', minRatio: 0.4 },
      { frame: 'enemy_health_fill_red', minRatio: 0 },
    ],
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
  trail: { maxLength: 46, width: 3, color: 0xffffff, alpha: 0.45 },
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
