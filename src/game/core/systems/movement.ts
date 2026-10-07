import { clamp, wrapAngle } from '../../../shared/math/angle';
import { add, fromAngle } from '../../../shared/math/vec2';
import type { PlayerInput, Ship, World } from '../types';

/** Translates abstract player commands into the ship's control for this step. */
export function applyPlayerInput(ship: Ship, input: PlayerInput): void {
  ship.control.throttle = input.forward ? 1 : 0;
  ship.control.turn = input.turn;
  ship.control.fire.front = input.fireFront;
  ship.control.fire.left = input.fireLeft;
  ship.control.fire.right = input.fireRight;
}

/** Rotation, acceleration/deceleration towards the throttle target, then forward motion. */
export function moveShips(world: World, dt: number): void {
  for (const ship of world.ships) {
    if (!ship.alive) continue;
    const stats = world.cfg.ships[ship.kind];
    const turn = clamp(ship.control.turn, -1, 1);
    ship.heading = wrapAngle(ship.heading + turn * world.angles.turnRate[ship.kind] * dt);

    const target = clamp(ship.control.throttle, 0, 1) * stats.maxSpeed;
    ship.speed =
      ship.speed < target
        ? Math.min(target, ship.speed + stats.acceleration * dt)
        : Math.max(target, ship.speed - stats.deceleration * dt);

    ship.pos = add(ship.pos, fromAngle(ship.heading, ship.speed * dt));
  }
}
