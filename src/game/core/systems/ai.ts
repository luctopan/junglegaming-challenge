import { angleDelta } from '../../../shared/math/angle';
import { angleOf, distance, sub } from '../../../shared/math/vec2';
import { hasLineOfSight, nextWaypoint, updateFlowField } from '../navigation/flowField';
import { getPlayer, hullRadius } from '../ships';
import type { Ship, World } from '../types';
import { faceTowards, steerTowards } from './steering';

/**
 * Enemy decisions for this step. Navigation: straight at the player when the
 * hull fits through the line of sight, otherwise along the flow field.
 */
export function updateEnemyAi(world: World, dt: number): void {
  const player = getPlayer(world);
  updateFlowField(world);
  for (const ship of world.ships) {
    if (!ship.alive || ship.team !== 'enemy') continue;
    ship.control.fire.front = false;
    if (!player.alive) {
      ship.control.throttle = 0;
      ship.control.turn = 0;
      continue;
    }
    if (ship.kind === 'shooter') updateShooter(world, ship, player, dt);
    else steerTowards(world, ship, routeTarget(world, ship, player), 1, dt);
  }
}

function routeTarget(world: World, ship: Ship, player: Ship): Ship['pos'] {
  if (hasLineOfSight(world, ship.pos, player.pos, hullRadius(world, ship))) return player.pos;
  return nextWaypoint(world, ship.pos) ?? player.pos;
}

/** Approach until within standoff distance with a clear shot, then hold and aim. */
function updateShooter(world: World, ship: Ship, player: Ship, dt: number): void {
  const { attackRange, standoffDistance } = world.cfg.shooter;
  const dist = distance(ship.pos, player.pos);
  const clearShot = hasLineOfSight(world, ship.pos, player.pos, world.cfg.projectile.radius);

  if (clearShot && dist <= standoffDistance) faceTowards(world, ship, player.pos, dt);
  else steerTowards(world, ship, routeTarget(world, ship, player), 1, dt);

  const aimError = Math.abs(angleDelta(ship.heading, angleOf(sub(player.pos, ship.pos))));
  ship.control.fire.front =
    clearShot && dist <= attackRange && aimError <= world.angles.shooterAimTolerance;
}
