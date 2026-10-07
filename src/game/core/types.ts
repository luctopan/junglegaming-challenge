import type { EnemyKind, GameConfig, ShipKind } from '../../config/gameConfig';
import type { Rng } from '../../shared/rng';
import type { Vec2 } from '../../shared/math/vec2';
import type { Rect } from './geometry';

export type { EnemyKind, ShipKind } from '../../config/gameConfig';

export type Team = 'player' | 'enemy';
export type WeaponSlot = 'front' | 'left' | 'right';
export type CannonKind = 'front' | 'broadside' | 'shooterCannon';
export type MatchPhase = 'running' | 'ended';
export type EndReason = 'time_up' | 'defeated';

/** Abstract player commands for one simulation step (keyboard/touch map onto this). */
export interface PlayerInput {
  readonly forward: boolean;
  /** -1 = turn left (counter-clockwise on screen), 1 = turn right. */
  readonly turn: -1 | 0 | 1;
  readonly fireFront: boolean;
  readonly fireLeft: boolean;
  readonly fireRight: boolean;
}

export const IDLE_INPUT: PlayerInput = Object.freeze({
  forward: false,
  turn: 0,
  fireFront: false,
  fireLeft: false,
  fireRight: false,
});

/** What a ship wants to do this step, written by input (player) or AI (enemies). */
export interface ShipControl {
  /** Target speed as a fraction of max speed, in [0, 1]. */
  throttle: number;
  /** Rotation as a fraction of the max turn rate, in [-1, 1]. */
  turn: number;
  fire: Record<WeaponSlot, boolean>;
}

export interface Ship {
  readonly id: number;
  readonly kind: ShipKind;
  readonly team: Team;
  pos: Vec2;
  /** Pose at the start of the last step, for render interpolation. */
  prevPos: Vec2;
  /** Radians; forward = (cos, sin) with y pointing down. */
  heading: number;
  prevHeading: number;
  speed: number;
  hp: number;
  readonly maxHp: number;
  alive: boolean;
  /** Seconds left as a non-colliding wreck once destroyed. */
  wreckTimeLeft: number;
  cooldowns: Record<WeaponSlot, number>;
  control: ShipControl;
}

export interface Projectile {
  readonly id: number;
  readonly ownerId: number;
  readonly team: Team;
  readonly cannon: CannonKind;
  pos: Vec2;
  prevPos: Vec2;
  readonly vel: Vec2;
  readonly damage: number;
  distanceLeft: number;
  alive: boolean;
}

/** Static arena data derived from the map and the config at match start. */
export interface Arena {
  readonly cols: number;
  readonly rows: number;
  readonly tileSize: number;
  readonly width: number;
  readonly height: number;
  /** Row-major: `water[row * cols + col]`. */
  readonly water: readonly boolean[];
  readonly islandRects: readonly Rect[];
}

/** Angles of the config converted to radians once per match. */
export interface DerivedAngles {
  readonly turnRate: Readonly<Record<ShipKind, number>>;
  readonly playerSpawnHeading: number;
  readonly shooterAimTolerance: number;
  readonly feelerAngle: number;
  readonly avoidanceTurn: number;
}

export interface SpawnerState {
  /** False only in isolated unit-test/tool scenarios (see `MatchOptions`). */
  readonly enabled: boolean;
  spawned: number;
  spawnedByKind: Record<EnemyKind, number>;
}

/** Flow field towards the player over water cells (BFS distance, ∞ = unreachable). */
export interface NavigationState {
  /** Cell the field was computed for; -1 before the first computation. */
  sourceCell: number;
  distances: number[];
  recomputeCount: number;
}

/** Whole simulation state: plain, serializable data. */
export interface World {
  readonly cfg: GameConfig;
  readonly angles: DerivedAngles;
  readonly arena: Arena;
  readonly seed: number;
  readonly rng: Rng;
  stepCount: number;
  /** Active simulated seconds (`stepCount × stepSeconds`, never a running float sum). */
  elapsedSeconds: number;
  readonly playerId: number;
  ships: Ship[];
  projectiles: Projectile[];
  score: number;
  phase: MatchPhase;
  endReason: EndReason | null;
  spawner: SpawnerState;
  nav: NavigationState;
  nextId: number;
}
