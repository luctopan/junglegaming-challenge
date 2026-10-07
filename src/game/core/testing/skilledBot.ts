import { angleDelta } from '../../../shared/math/angle';
import type { Vec2 } from '../../../shared/math/vec2';
import { add, angleOf, distance, fromAngle, sub } from '../../../shared/math/vec2';
import { firstRoundedRectHit } from '../geometry';
import { cellIndexAt } from '../map/arena';
import { computeDistances, hasLineOfSight, waypointFrom } from '../navigation/flowField';
import { aliveEnemies, getPlayer, hullRadius } from '../ships';
import type { PlayerInput, Ship, WeaponSlot, World } from '../types';
import { IDLE_INPUT } from '../types';

/**
 * "Skilled" deterministic player for the balance tool: kites Chasers, routes
 * around islands with the flow field, keeps off shores and arena edges, and
 * only pulls a trigger when that weapon bears on an enemy.
 *
 * The constants below are chosen for sensible play once, up front; they are
 * deliberately NOT tuned to hit a balance target (that would make the report
 * meaningless). They belong to the bot, not to the game config.
 */

/** Approximate human reaction time: the bot decides at most this often and holds its input. */
const DECISION_INTERVAL_SECONDS = 0.2;
/** A Chaser closer than this is evaded instead of engaged head-on. */
const KITE_STANDOFF = 200;
/** Extra angle away from a kited Chaser beyond keeping it abeam (radians). */
const KITE_AWAY_ANGLE = 0.3;
/** Close to this distance, then turn broadside. */
const ENGAGE_DISTANCE = 240;
/** Obstacle lookahead from the ship centre. */
const LOOKAHEAD = 110;
/** Headings whose lookahead ends closer than this to the border count as blocked. */
const EDGE_MARGIN = 60;
const PROBE_STEP = Math.PI / 8;
const PROBE_COUNT = 8;
const FRONT_TOLERANCE = 0.1;
const BROADSIDE_TOLERANCE = 0.3;
const STEER_DEADBAND = 0.08;
const QUARTER_TURN = Math.PI / 2;

interface BotMemory {
  nextDecisionAt: number;
  held: PlayerInput;
  field: { cell: number; distances: number[] } | null;
}

/** Per-world memory, so the bot stays a pure function of the match it plays. */
const memories = new WeakMap<World, BotMemory>();

export function skilledBotInput(world: World): PlayerInput {
  const memory = memories.get(world) ?? { nextDecisionAt: 0, held: IDLE_INPUT, field: null };
  memories.set(world, memory);
  if (world.elapsedSeconds + 1e-9 < memory.nextDecisionAt) {
    // Between decisions: keep sailing as decided; triggers are taps, not held.
    return { ...memory.held, fireFront: false, fireLeft: false, fireRight: false };
  }
  memory.nextDecisionAt = world.elapsedSeconds + DECISION_INTERVAL_SECONDS;
  memory.held = decide(world, memory);
  return memory.held;
}

function decide(world: World, memory: BotMemory): PlayerInput {
  const player = getPlayer(world);
  if (!player.alive) return IDLE_INPUT;
  const desired = clearHeading(world, player, desiredHeading(world, player, memory));
  return {
    forward: true,
    turn: steer(angleDelta(player.heading, desired)),
    fireFront: weaponBears(world, 'front'),
    fireLeft: weaponBears(world, 'left'),
    fireRight: weaponBears(world, 'right'),
  };
}

function desiredHeading(world: World, player: Ship, memory: BotMemory): number {
  const enemies = aliveEnemies(world);
  const nearest = (ships: Ship[]): Ship | undefined =>
    ships.reduce<Ship | undefined>(
      (best, s) =>
        best === undefined || distance(s.pos, player.pos) < distance(best.pos, player.pos)
          ? s
          : best,
      undefined,
    );

  const chaser = nearest(enemies.filter((e) => e.kind === 'chaser'));
  if (chaser && distance(chaser.pos, player.pos) < KITE_STANDOFF) {
    // Keep the Chaser abeam and slightly astern: it falls into a broadside arc.
    const toChaser = angleOf(sub(chaser.pos, player.pos));
    const options = [
      toChaser + QUARTER_TURN + KITE_AWAY_ANGLE,
      toChaser - QUARTER_TURN - KITE_AWAY_ANGLE,
    ];
    return closestTo(player.heading, options);
  }

  const target = nearest(enemies);
  if (!target)
    return angleOf(sub({ x: world.arena.width / 2, y: world.arena.height / 2 }, player.pos));

  const bearing = angleOf(sub(target.pos, player.pos));
  if (hasLineOfSight(world, player.pos, target.pos, hullRadius(world, player))) {
    if (distance(target.pos, player.pos) > ENGAGE_DISTANCE) return bearing;
    return closestTo(player.heading, [bearing + QUARTER_TURN, bearing - QUARTER_TURN]);
  }
  const waypoint = routeTowards(world, memory, player.pos, target.pos);
  return angleOf(sub(waypoint, player.pos));
}

/** Next flow-field waypoint towards `goal`; the field is recomputed only when the goal changes cell. */
function routeTowards(world: World, memory: BotMemory, from: Vec2, goal: Vec2): Vec2 {
  const cell = cellIndexAt(world.arena, goal);
  if (memory.field?.cell !== cell) {
    memory.field = { cell, distances: computeDistances(world.arena, cell) };
  }
  return waypointFrom(world.arena, memory.field.distances, from) ?? goal;
}

/** The desired heading if its lookahead is clear, else the nearest clear alternative. */
function clearHeading(world: World, player: Ship, desired: number): number {
  for (let k = 0; k <= PROBE_COUNT; k++) {
    for (const sign of k === 0 ? [1] : [1, -1]) {
      const heading = desired + sign * k * PROBE_STEP;
      if (isClear(world, player, heading)) return heading;
    }
  }
  return desired;
}

function isClear(world: World, player: Ship, heading: number): boolean {
  const end = add(player.pos, fromAngle(heading, LOOKAHEAD));
  const { width, height, islandRects } = world.arena;
  const insideMargin =
    end.x >= EDGE_MARGIN &&
    end.y >= EDGE_MARGIN &&
    end.x <= width - EDGE_MARGIN &&
    end.y <= height - EDGE_MARGIN;
  return (
    insideMargin &&
    firstRoundedRectHit(player.pos, end, islandRects, hullRadius(world, player)) === null
  );
}

/**
 * True when a live enemy is inside the weapon's arc, within range and with a
 * clear line for the ball. Exported so tests can check the bot's fire discipline.
 */
export function weaponBears(world: World, slot: WeaponSlot): boolean {
  const player = getPlayer(world);
  if (!player.alive) return false;
  const axis =
    slot === 'front'
      ? player.heading
      : player.heading + (slot === 'left' ? -QUARTER_TURN : QUARTER_TURN);
  const tolerance = slot === 'front' ? FRONT_TOLERANCE : BROADSIDE_TOLERANCE;
  const cannon = slot === 'front' ? world.cfg.weapons.front : world.cfg.weapons.broadside;
  return aliveEnemies(world).some((enemy) => {
    const offset = sub(enemy.pos, player.pos);
    return (
      Math.abs(angleDelta(axis, angleOf(offset))) <= tolerance &&
      distance(enemy.pos, player.pos) <= cannon.projectileRange &&
      hasLineOfSight(world, player.pos, enemy.pos, world.cfg.projectile.radius)
    );
  });
}

const closestTo = (heading: number, options: readonly number[]): number =>
  options.reduce((best, h) =>
    Math.abs(angleDelta(heading, h)) < Math.abs(angleDelta(heading, best)) ? h : best,
  );

const steer = (delta: number): -1 | 0 | 1 =>
  delta > STEER_DEADBAND ? 1 : delta < -STEER_DEADBAND ? -1 : 0;
