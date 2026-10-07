import type { CannonConfig, GameConfig, ShipStats } from './gameConfig';
import { ENEMY_KINDS } from './gameConfig';
import { describeBounds, isWithinBounds, OPTION_BOUNDS } from './options';

export interface ConfigIssue {
  /** Dotted path of the offending field, e.g. `ships.chaser.maxSpeed`. */
  readonly path: string;
  readonly message: string;
}

export type ConfigValidation =
  { readonly ok: true } | { readonly ok: false; readonly issues: readonly ConfigIssue[] };

const MAX_FEELER_ANGLE_DEG = 90;
const MAX_AIM_TOLERANCE_DEG = 180;

/** Collects issues so a single run reports every invalid field. */
class Checker {
  readonly issues: ConfigIssue[] = [];

  check(path: string, ok: boolean, message: string): void {
    if (!ok) this.issues.push({ path, message });
  }

  positive(path: string, value: number): void {
    this.check(path, Number.isFinite(value) && value > 0, 'must be a finite number > 0');
  }

  nonNegative(path: string, value: number): void {
    this.check(path, Number.isFinite(value) && value >= 0, 'must be a finite number >= 0');
  }

  finite(path: string, value: number): void {
    this.check(path, Number.isFinite(value), 'must be a finite number');
  }

  integerAtLeastOne(path: string, value: number): void {
    this.check(path, Number.isInteger(value) && value >= 1, 'must be an integer >= 1');
  }

  inRange(path: string, value: number, min: number, max: number): void {
    this.check(
      path,
      Number.isFinite(value) && value >= min && value <= max,
      `must be between ${min} and ${max}`,
    );
  }
}

function checkShip(c: Checker, path: string, ship: ShipStats): void {
  c.positive(`${path}.maxHp`, ship.maxHp);
  c.positive(`${path}.maxSpeed`, ship.maxSpeed);
  c.positive(`${path}.acceleration`, ship.acceleration);
  c.positive(`${path}.deceleration`, ship.deceleration);
  c.positive(`${path}.turnRateDegPerSec`, ship.turnRateDegPerSec);
  c.positive(`${path}.hull.circleRadius`, ship.hull.circleRadius);
  c.check(
    `${path}.hull.circleOffset`,
    ship.hull.circleOffset >= 0 && ship.hull.circleOffset < ship.hull.circleRadius,
    'must be >= 0 and < hull.circleRadius (circles must overlap, no gap amidships)',
  );
}

function checkCannon(c: Checker, path: string, cannon: CannonConfig): void {
  c.positive(`${path}.damage`, cannon.damage);
  c.positive(`${path}.cooldownSeconds`, cannon.cooldownSeconds);
  c.positive(`${path}.projectileSpeed`, cannon.projectileSpeed);
  c.positive(`${path}.projectileRange`, cannon.projectileRange);
  c.nonNegative(`${path}.muzzleOffset`, cannon.muzzleOffset);
}

/** Pure validation of a full gameplay config; never throws. */
export function validateGameConfig(cfg: GameConfig): ConfigValidation {
  const c = new Checker();
  const { simulation, arena, spawn, shooter, ai, damage } = cfg;

  c.positive('simulation.stepSeconds', simulation.stepSeconds);
  c.check(
    'simulation.maxFrameSeconds',
    Number.isFinite(simulation.maxFrameSeconds) &&
      simulation.maxFrameSeconds >= simulation.stepSeconds,
    'must be >= simulation.stepSeconds',
  );
  c.integerAtLeastOne('simulation.maxStepsPerFrame', simulation.maxStepsPerFrame);

  c.check(
    'match.sessionSeconds',
    isWithinBounds(cfg.match.sessionSeconds, OPTION_BOUNDS.sessionSeconds),
    describeBounds(OPTION_BOUNDS.sessionSeconds),
  );

  c.positive('arena.tileSize', arena.tileSize);
  c.check(
    'arena.islandCollisionInset',
    Number.isFinite(arena.islandCollisionInset) &&
      arena.islandCollisionInset >= 0 &&
      arena.islandCollisionInset * 2 < arena.tileSize,
    'must be >= 0 and less than half a tile',
  );
  // Islands are at least two tiles wide, so two corners of one side always fit.
  c.check(
    'arena.islandCornerRadius',
    Number.isFinite(arena.islandCornerRadius) &&
      arena.islandCornerRadius >= 0 &&
      arena.islandCornerRadius <= arena.tileSize - arena.islandCollisionInset,
    'must be >= 0 and at most one tile minus the inset',
  );

  checkShip(c, 'ships.player', cfg.ships.player);
  for (const kind of ENEMY_KINDS) checkShip(c, `ships.${kind}`, cfg.ships[kind]);

  c.finite('playerSpawn.x', cfg.playerSpawn.x);
  c.finite('playerSpawn.y', cfg.playerSpawn.y);
  c.finite('playerSpawn.headingDeg', cfg.playerSpawn.headingDeg);

  checkCannon(c, 'weapons.front', cfg.weapons.front);
  checkCannon(c, 'weapons.broadside', cfg.weapons.broadside);
  c.integerAtLeastOne('weapons.broadside.count', cfg.weapons.broadside.count);
  c.nonNegative('weapons.broadside.spacing', cfg.weapons.broadside.spacing);
  checkCannon(c, 'weapons.shooterCannon', cfg.weapons.shooterCannon);

  c.positive('projectile.radius', cfg.projectile.radius);
  c.positive('chaser.ramDamage', cfg.chaser.ramDamage);

  c.positive('shooter.attackRange', shooter.attackRange);
  c.check(
    'shooter.standoffDistance',
    Number.isFinite(shooter.standoffDistance) &&
      shooter.standoffDistance >= 0 &&
      shooter.standoffDistance <= shooter.attackRange,
    'must be >= 0 and <= shooter.attackRange',
  );
  c.check(
    'shooter.aimToleranceDeg',
    shooter.aimToleranceDeg > 0 && shooter.aimToleranceDeg <= MAX_AIM_TOLERANCE_DEG,
    `must be > 0 and <= ${MAX_AIM_TOLERANCE_DEG}`,
  );

  c.positive('ai.feelerLength', ai.feelerLength);
  c.check(
    'ai.feelerAngleDeg',
    ai.feelerAngleDeg > 0 && ai.feelerAngleDeg < MAX_FEELER_ANGLE_DEG,
    `must be > 0 and < ${MAX_FEELER_ANGLE_DEG}`,
  );
  c.nonNegative('ai.avoidanceTurnDeg', ai.avoidanceTurnDeg);
  c.inRange('ai.minThrottle', ai.minThrottle, 0, 1);

  c.integerAtLeastOne('collision.iterations', cfg.collision.iterations);

  c.check(
    'spawn.intervalSeconds',
    isWithinBounds(spawn.intervalSeconds, OPTION_BOUNDS.spawnIntervalSeconds),
    describeBounds(OPTION_BOUNDS.spawnIntervalSeconds),
  );
  for (const kind of ENEMY_KINDS) c.nonNegative(`spawn.weights.${kind}`, spawn.weights[kind]);
  c.check(
    'spawn.weights',
    ENEMY_KINDS.reduce((sum, kind) => sum + spawn.weights[kind], 0) > 0,
    'must have a positive total',
  );
  c.integerAtLeastOne('spawn.maxAliveEnemies', spawn.maxAliveEnemies);
  c.nonNegative('spawn.minDistanceFromPlayer', spawn.minDistanceFromPlayer);
  c.positive('spawn.clearanceRadius', spawn.clearanceRadius);
  c.nonNegative('spawn.edgeInset', spawn.edgeInset);
  c.integerAtLeastOne('spawn.attemptsPerStep', spawn.attemptsPerStep);

  c.check(
    'damage.stageThresholds',
    damage.stageThresholds.every(
      (t, i) => t > 0 && t < 1 && (i === 0 || t < (damage.stageThresholds[i - 1] ?? 1)),
    ),
    'must be strictly descending values in (0, 1)',
  );
  c.nonNegative('damage.wreckSeconds', damage.wreckSeconds);

  return c.issues.length === 0 ? { ok: true } : { ok: false, issues: c.issues };
}
