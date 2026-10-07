import { angleDelta, clamp } from '../../../shared/math/angle';
import type { Vec2 } from '../../../shared/math/vec2';
import { add, angleOf, distance, fromAngle, sub } from '../../../shared/math/vec2';
import { HALF } from '../../../shared/math/constants';
import { firstRectHit } from '../geometry';
import { hullRadius } from '../ships';
import type { Ship, World } from '../types';

const QUARTER_TURN = Math.PI * HALF;

/**
 * Sets turn/throttle to head for `target`: rotate at most the max turn rate,
 * thrust scaled by how well the bow is aligned, plus feeler-based avoidance
 * for islands closer than the target.
 */
export function steerTowards(
  world: World,
  ship: Ship,
  target: Vec2,
  throttleScale: number,
  dt: number,
): void {
  const bearing = angleOf(sub(target, ship.pos));
  // Avoidance only while the target is ahead: when it is behind, the ship is
  // turning round anyway, and a bias near ±180° would flip the turn direction
  // every step (the ship would stall in concave pockets).
  const targetAhead = Math.abs(angleDelta(ship.heading, bearing)) < QUARTER_TURN;
  const desired = bearing + (targetAhead ? feelerAvoidance(world, ship, target) : 0);
  const delta = angleDelta(ship.heading, desired);
  const maxTurn = world.angles.turnRate[ship.kind] * dt;
  ship.control.turn = clamp(delta / maxTurn, -1, 1);
  ship.control.throttle = throttleScale * clamp(Math.cos(delta), world.cfg.ai.minThrottle, 1);
}

/** Rotates in place to face `target` without moving. */
export function faceTowards(world: World, ship: Ship, target: Vec2, dt: number): void {
  const delta = angleDelta(ship.heading, angleOf(sub(target, ship.pos)));
  ship.control.turn = clamp(delta / (world.angles.turnRate[ship.kind] * dt), -1, 1);
  ship.control.throttle = 0;
}

/**
 * Three rays (bow, port, starboard). A hit on one side turns the ship towards
 * the other, more strongly the closer the hit. Rays stop at the target so a
 * target next to a shore does not repel its pursuer.
 */
export function feelerAvoidance(world: World, ship: Ship, target: Vec2): number {
  const { feelerLength } = world.cfg.ai;
  const { feelerAngle, avoidanceTurn } = world.angles;
  const reach = Math.min(feelerLength, distance(ship.pos, target));
  const padding = hullRadius(world, ship);
  const probe = (angle: number): number | null =>
    firstRectHit(
      ship.pos,
      add(ship.pos, fromAngle(angle, reach)),
      world.arena.islandRects,
      padding,
    );

  const port = probe(ship.heading - feelerAngle);
  const bow = probe(ship.heading);
  const starboard = probe(ship.heading + feelerAngle);
  const nearest = Math.min(port ?? 1, bow ?? 1, starboard ?? 1);
  if (port === null && bow === null && starboard === null) return 0;

  const closeness = 1 - nearest;
  // Turn away from the side whose ray hits closer (a miss counts as far away).
  const turnToStarboard = (port ?? 1) <= (starboard ?? 1);
  return (turnToStarboard ? 1 : -1) * avoidanceTurn * closeness;
}
