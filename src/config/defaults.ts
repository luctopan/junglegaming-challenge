import { cloneDeepFrozen } from '../shared/deepFreeze';
import type { GameConfig, HullConfig } from './gameConfig';

/**
 * Ship sprites are 66×113. Two overlapping circles cover the hull (±42 u along the
 * axis) without the sail overhang; the overlap leaves no gap amidships.
 */
const HULL: HullConfig = { circleRadius: 24, circleOffset: 18 };

/** Default balancing (docs/DECISIONS.md, PLAN §5). */
export const DEFAULT_GAME_CONFIG: GameConfig = cloneDeepFrozen<GameConfig>({
  simulation: { stepSeconds: 1 / 60, maxFrameSeconds: 0.25, maxStepsPerFrame: 8 },
  match: { sessionSeconds: 120 },
  // Inset 0: the straight shore art reaches the tile edge (≈1.5 px in). Corner radius 61:
  // best circle fit of the rounded corner tiles, ≤ 4 px off anywhere (DECISIONS R4).
  arena: { tileSize: 64, islandCollisionInset: 0, islandCornerRadius: 61 },
  ships: {
    player: {
      maxHp: 200,
      maxSpeed: 140,
      acceleration: 160,
      deceleration: 120,
      turnRateDegPerSec: 150,
      hull: HULL,
    },
    chaser: {
      maxHp: 30,
      maxSpeed: 105,
      acceleration: 140,
      deceleration: 140,
      turnRateDegPerSec: 120,
      hull: HULL,
    },
    shooter: {
      maxHp: 50,
      maxSpeed: 90,
      acceleration: 100,
      deceleration: 120,
      turnRateDegPerSec: 90,
      hull: HULL,
    },
  },
  // Open water between the three islands (ARENA_MAP), facing north.
  playerSpawn: { x: 448, y: 288, headingDeg: -90 },
  weapons: {
    front: {
      damage: 20,
      cooldownSeconds: 0.5,
      projectileSpeed: 420,
      projectileRange: 380,
      muzzleOffset: 56,
    },
    broadside: {
      damage: 15,
      cooldownSeconds: 1.5,
      projectileSpeed: 420,
      projectileRange: 380,
      muzzleOffset: 30,
      count: 3,
      spacing: 28,
    },
    shooterCannon: {
      damage: 7,
      cooldownSeconds: 2.5,
      projectileSpeed: 420,
      projectileRange: 380,
      muzzleOffset: 56,
    },
  },
  projectile: { radius: 5 },
  chaser: { ramDamage: 20 },
  shooter: { attackRange: 300, standoffDistance: 220, aimToleranceDeg: 12 },
  ai: { feelerLength: 90, feelerAngleDeg: 30, avoidanceTurnDeg: 60, minThrottle: 0.2 },
  collision: { iterations: 3 },
  spawn: {
    intervalSeconds: 3,
    weights: { chaser: 0.5, shooter: 0.5 },
    guaranteeEachKindInFirstTwo: true,
    maxAliveEnemies: 25,
    minDistanceFromPlayer: 320,
    clearanceRadius: 70,
    edgeInset: 60,
    attemptsPerStep: 12,
  },
  damage: { stageThresholds: [2 / 3, 1 / 3], wreckSeconds: 0.8 },
});
