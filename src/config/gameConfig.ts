/**
 * Every gameplay and balancing parameter. Systems read only from a frozen
 * snapshot of this object taken at match start, so balancing never requires
 * changes to system logic.
 *
 * Units: distances in world units (u; the arena is 16×9 tiles of `arena.tileSize`),
 * speeds in u/s, accelerations in u/s², times in seconds, angles in **degrees**
 * (converted to radians once when the match snapshot is created).
 */
export type ShipKind = 'player' | 'chaser' | 'shooter';
export type EnemyKind = Exclude<ShipKind, 'player'>;

export const ENEMY_KINDS: readonly EnemyKind[] = ['chaser', 'shooter'];

export interface HullConfig {
  /** Ships collide as two circles placed at ±`circleOffset` along the hull axis. */
  readonly circleRadius: number;
  readonly circleOffset: number;
}

export interface ShipStats {
  readonly maxHp: number;
  readonly maxSpeed: number;
  readonly acceleration: number;
  readonly deceleration: number;
  readonly turnRateDegPerSec: number;
  readonly hull: HullConfig;
}

export interface CannonConfig {
  readonly damage: number;
  readonly cooldownSeconds: number;
  readonly projectileSpeed: number;
  /** Distance travelled before the ball falls into the water. */
  readonly projectileRange: number;
  /** Distance from the ship centre where balls appear (forward for front guns, sideways for broadsides). */
  readonly muzzleOffset: number;
}

export interface BroadsideConfig extends CannonConfig {
  /** Balls per side, fired in parallel. */
  readonly count: number;
  /** Distance between neighbouring balls, along the hull axis. */
  readonly spacing: number;
}

export interface GameConfig {
  readonly simulation: {
    /** Fixed simulation step. */
    readonly stepSeconds: number;
    /** Longest real frame fed to the accumulator (tab stalls, debugger pauses). */
    readonly maxFrameSeconds: number;
    /** Upper bound of steps per rendered frame; the excess is dropped (no spiral of death). */
    readonly maxStepsPerFrame: number;
  };
  readonly match: {
    readonly sessionSeconds: number;
  };
  readonly arena: {
    readonly tileSize: number;
    /** Shrinks island collision rects on sides facing water, to match rounded tile art. */
    readonly islandCollisionInset: number;
    /**
     * Radius of the convex island corners (where both sides face water), matching
     * the rounded shore art. Junctions between the rects of one island stay square.
     */
    readonly islandCornerRadius: number;
  };
  readonly ships: Readonly<Record<ShipKind, ShipStats>>;
  readonly playerSpawn: {
    readonly x: number;
    readonly y: number;
    readonly headingDeg: number;
  };
  readonly weapons: {
    readonly front: CannonConfig;
    readonly broadside: BroadsideConfig;
    readonly shooterCannon: CannonConfig;
  };
  readonly projectile: {
    readonly radius: number;
  };
  readonly chaser: {
    readonly ramDamage: number;
  };
  readonly shooter: {
    readonly attackRange: number;
    /** Distance at which a Shooter with line of sight stops closing in. */
    readonly standoffDistance: number;
    readonly aimToleranceDeg: number;
  };
  readonly ai: {
    /** Length of the obstacle-avoidance feelers, measured from the ship centre. */
    readonly feelerLength: number;
    readonly feelerAngleDeg: number;
    /** Extra heading applied away from an island hit by a feeler, scaled by closeness. */
    readonly avoidanceTurnDeg: number;
    /** Thrust while facing away from the target, as a fraction of max speed. */
    readonly minThrottle: number;
  };
  readonly collision: {
    /** Relaxation passes for ship separation + island push-out. */
    readonly iterations: number;
  };
  readonly spawn: {
    readonly intervalSeconds: number;
    readonly weights: Readonly<Record<EnemyKind, number>>;
    /** Forces the second spawn to be the kind the first one was not. */
    readonly guaranteeEachKindInFirstTwo: boolean;
    /** Performance guard: due spawns wait (never dropped) while this many enemies are alive. */
    readonly maxAliveEnemies: number;
    readonly minDistanceFromPlayer: number;
    /** Radius around a spawn point that must be free of islands and ships. */
    readonly clearanceRadius: number;
    /** Distance of spawn points from the arena border. */
    readonly edgeInset: number;
    /** Placement attempts per simulation step; pending spawns retry on the next step. */
    readonly attemptsPerStep: number;
  };
  readonly damage: {
    /** HP-ratio thresholds, strictly descending: ratio ≤ thresholds[i] ⇒ stage ≥ i + 1. */
    readonly stageThresholds: readonly number[];
    /** How long a destroyed ship stays as a non-colliding wreck before removal. */
    readonly wreckSeconds: number;
  };
}
