import { angleDelta } from '../../../shared/math/angle';
import { angleOf, distance, sub } from '../../../shared/math/vec2';
import { aliveEnemies, getPlayer } from '../ships';
import type { PlayerInput, World } from '../types';
import { IDLE_INPUT } from '../types';

/**
 * Deterministic "player" used by headless tests and the balance tool: sails
 * at the nearest enemy, turns broadside when close and fires whatever bears.
 * It reads the world only (no randomness), so a seed fully defines a match.
 */
const AIM_TOLERANCE = 0.12;
const BROADSIDE_TOLERANCE = 0.3;
const BROADSIDE_DISTANCE = 220;
const STEER_DEADBAND = 0.05;
const QUARTER_TURN = Math.PI / 2;

export function scriptedBotInput(world: World): PlayerInput {
  const player = getPlayer(world);
  if (!player.alive) return IDLE_INPUT;
  const target = aliveEnemies(world).reduce<{
    d: number;
    pos: World['ships'][number]['pos'];
  } | null>((best, enemy) => {
    const d = distance(enemy.pos, player.pos);
    return best === null || d < best.d ? { d, pos: enemy.pos } : best;
  }, null);
  if (target === null) return patrol(world);

  const bearing = angleOf(sub(target.pos, player.pos));
  const range = world.cfg.weapons.front.projectileRange;
  const port = angleDelta(player.heading - QUARTER_TURN, bearing);
  const starboard = angleDelta(player.heading + QUARTER_TURN, bearing);
  const desired =
    target.d > BROADSIDE_DISTANCE
      ? bearing
      : Math.abs(port) < Math.abs(starboard)
        ? bearing + QUARTER_TURN
        : bearing - QUARTER_TURN;
  return {
    forward: true,
    turn: steer(angleDelta(player.heading, desired)),
    fireFront: Math.abs(angleDelta(player.heading, bearing)) < AIM_TOLERANCE && target.d < range,
    fireLeft: Math.abs(port) < BROADSIDE_TOLERANCE && target.d < range,
    fireRight: Math.abs(starboard) < BROADSIDE_TOLERANCE && target.d < range,
  };
}

function patrol(world: World): PlayerInput {
  const player = getPlayer(world);
  const center = { x: world.arena.width / 2, y: world.arena.height / 2 };
  return {
    ...IDLE_INPUT,
    forward: true,
    turn: steer(angleDelta(player.heading, angleOf(sub(center, player.pos)))),
  };
}

const steer = (delta: number): -1 | 0 | 1 =>
  delta > STEER_DEADBAND ? 1 : delta < -STEER_DEADBAND ? -1 : 0;
