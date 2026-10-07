import { DEFAULT_GAME_CONFIG } from '../../../config/defaults';
import type { GameConfig } from '../../../config/gameConfig';
import type { Vec2 } from '../../../shared/math/vec2';
import type { MatchOptions } from '../createMatch';
import { POCKET_MAP } from './maps';
import { createMatch } from '../createMatch';
import type { DomainEvent } from '../events';
import { addShip } from '../ships';
import { step } from '../step';
import type { PlayerInput, Ship, ShipKind, World } from '../types';
import { IDLE_INPUT } from '../types';

export type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };

/**
 * Player spawn of isolated system tests: clear water on both test maps, so those
 * tests do not move whenever the real map (and its spawn point) is redesigned.
 */
export const SYSTEM_TEST_SPAWN: GameConfig['playerSpawn'] = Object.freeze({
  x: 512,
  y: 448,
  headingDeg: -90,
});

/** Deep copy of the defaults with a test-specific tweak applied. */
export function configWith(
  tweak: (cfg: Mutable<GameConfig>) => void = () => undefined,
): GameConfig {
  const cfg = JSON.parse(JSON.stringify(DEFAULT_GAME_CONFIG)) as Mutable<GameConfig>;
  tweak(cfg);
  return cfg;
}

/**
 * A match without automatic spawns, for isolated system tests: on
 * `POCKET_MAP` (unless `options.map` says otherwise) with the player at
 * `SYSTEM_TEST_SPAWN`, independent of the real arena layout.
 */
export function quietWorld(
  cfg: GameConfig = DEFAULT_GAME_CONFIG,
  options: MatchOptions = {},
): World {
  return createMatch({ ...cfg, playerSpawn: SYSTEM_TEST_SPAWN }, 1, {
    spawnEnemies: false,
    map: POCKET_MAP,
    ...options,
  });
}

export const place = (world: World, kind: ShipKind, pos: Vec2, heading = 0): Ship =>
  addShip(world, kind, pos, heading);

export function input(partial: Partial<PlayerInput>): PlayerInput {
  return { ...IDLE_INPUT, ...partial };
}

/** Runs `steps` steps with a fixed (or per-step) input and returns all events. */
export function run(
  world: World,
  steps: number,
  playerInput: PlayerInput | ((world: World) => PlayerInput) = IDLE_INPUT,
): DomainEvent[] {
  const events: DomainEvent[] = [];
  for (let i = 0; i < steps; i++) {
    events.push(
      ...step(world, typeof playerInput === 'function' ? playerInput(world) : playerInput),
    );
  }
  return events;
}

export const stepsFor = (world: World, seconds: number): number =>
  Math.round(seconds / world.cfg.simulation.stepSeconds);

export const ofType = <T extends DomainEvent['type']>(
  events: readonly DomainEvent[],
  type: T,
): Extract<DomainEvent, { type: T }>[] =>
  events.filter((e): e is Extract<DomainEvent, { type: T }> => e.type === type);
