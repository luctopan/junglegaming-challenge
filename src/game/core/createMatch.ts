import type { GameConfig } from '../../config/gameConfig';
import { validateGameConfig } from '../../config/validate';
import { toRadians } from '../../shared/math/angle';
import { cloneDeepFrozen } from '../../shared/deepFreeze';
import { createRng } from '../../shared/rng';
import { ARENA_MAP } from './map/arenaMap';
import { buildArena } from './map/arena';
import { addShip, hullCircles, hullRadius } from './ships';
import { circleRoundedRectPushOut } from './geometry';
import type { DerivedAngles, World } from './types';

export interface MatchOptions {
  /**
   * Disables enemy spawning. Only for isolated unit-test scenarios and the
   * balance tool; never exposed to the game UI or the test hook.
   */
  readonly spawnEnemies?: boolean;
  /** Arena layout override (unit tests); defaults to `ARENA_MAP`. */
  readonly map?: readonly string[];
}

export class InvalidMatchConfigError extends Error {
  constructor(readonly issues: readonly { path: string; message: string }[]) {
    super(`Invalid game config: ${issues.map((i) => `${i.path} ${i.message}`).join('; ')}`);
    this.name = 'InvalidMatchConfigError';
  }
}

function deriveAngles(cfg: GameConfig): DerivedAngles {
  return {
    turnRate: {
      player: toRadians(cfg.ships.player.turnRateDegPerSec),
      chaser: toRadians(cfg.ships.chaser.turnRateDegPerSec),
      shooter: toRadians(cfg.ships.shooter.turnRateDegPerSec),
    },
    playerSpawnHeading: toRadians(cfg.playerSpawn.headingDeg),
    shooterAimTolerance: toRadians(cfg.shooter.aimToleranceDeg),
    feelerAngle: toRadians(cfg.ai.feelerAngleDeg),
    avoidanceTurn: toRadians(cfg.ai.avoidanceTurnDeg),
  };
}

/**
 * Fresh match state. The config is validated and deep-frozen into the world, so
 * later edits to the Options only affect matches created afterwards.
 */
export function createMatch(config: GameConfig, seed: number, options: MatchOptions = {}): World {
  const validation = validateGameConfig(config);
  if (!validation.ok) throw new InvalidMatchConfigError(validation.issues);
  const cfg: GameConfig = cloneDeepFrozen(config);
  const angles = cloneDeepFrozen(deriveAngles(cfg));
  const arena = cloneDeepFrozen(
    buildArena(
      options.map ?? ARENA_MAP,
      cfg.arena.tileSize,
      cfg.arena.islandCollisionInset,
      cfg.arena.islandCornerRadius,
    ),
  );

  const world: World = {
    cfg,
    angles,
    arena,
    seed,
    rng: createRng(seed),
    stepCount: 0,
    elapsedSeconds: 0,
    playerId: 0,
    ships: [],
    projectiles: [],
    score: 0,
    phase: 'running',
    endReason: null,
    spawner: {
      enabled: options.spawnEnemies ?? true,
      spawned: 0,
      spawnedByKind: { chaser: 0, shooter: 0 },
    },
    nav: { sourceCell: -1, distances: [], recomputeCount: 0 },
    nextId: 0,
  };

  const player = addShip(
    world,
    'player',
    { x: cfg.playerSpawn.x, y: cfg.playerSpawn.y },
    angles.playerSpawnHeading,
  );
  assertSpawnIsClear(world, player);
  return world;
}

function assertSpawnIsClear(world: World, player: World['ships'][number]): void {
  const radius = hullRadius(world, player);
  const { width, height, islandRects } = world.arena;
  const blocked = hullCircles(world, player).some(
    (c) =>
      c.x < radius ||
      c.y < radius ||
      c.x > width - radius ||
      c.y > height - radius ||
      islandRects.some((r) => circleRoundedRectPushOut(c, radius, r) !== null),
  );
  if (blocked) {
    throw new InvalidMatchConfigError([
      { path: 'playerSpawn', message: 'is outside the arena or overlaps an island' },
    ]);
  }
}
