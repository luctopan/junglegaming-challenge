/**
 * Public API of the simulation core (pure, deterministic TypeScript).
 * See ARCHITECTURE.md "Simulation loop" and "Collisions".
 */
export { createMatch, InvalidMatchConfigError } from './createMatch';
export type { MatchOptions } from './createMatch';
export { step } from './step';
export { createFixedStepper } from './stepper';
export type { FixedStepper, FixedStepperOptions, TickResult } from './stepper';
export { damageStage } from './damageStage';
export { timeLeftSeconds } from './systems/match';
export { getPlayer } from './ships';
export { ARENA_MAP } from './map/arenaMap';
export { shoreShape } from './map/shoreShape';
export type { Corner, ShoreShape, Side, SolidAt } from './map/shoreShape';
export type { DomainEvent, DomainEventType } from './events';
export type { Rect } from './geometry';
export { IDLE_INPUT } from './types';
export type {
  Arena,
  CannonKind,
  EndReason,
  EnemyKind,
  MatchPhase,
  PlayerInput,
  Projectile,
  Ship,
  ShipKind,
  Team,
  WeaponSlot,
  World,
} from './types';
