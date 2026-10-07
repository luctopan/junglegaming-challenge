import { HALF } from '../../../shared/math/constants';
import type { Vec2 } from '../../../shared/math/vec2';
import { add, distance, scale, sub } from '../../../shared/math/vec2';
import { circleRectPushOut } from '../geometry';
import { hullCircles, hullRadius } from '../ships';
import type { Ship, World } from '../types';

/**
 * Relaxation passes: ships push each other apart, then islands and arena bounds
 * push ships out. Static geometry always runs last, so it wins over separation.
 */
export function resolveShipCollisions(world: World): void {
  const alive = world.ships.filter((s) => s.alive);
  for (let i = 0; i < world.cfg.collision.iterations; i++) {
    separateShips(world, alive);
    for (const ship of alive) resolveStatic(world, ship);
  }
}

/** A Chaser touching the player rams instead of being pushed (see systems/ram.ts). */
const rams = (a: Ship, b: Ship): boolean =>
  (a.kind === 'chaser' && b.kind === 'player') || (a.kind === 'player' && b.kind === 'chaser');

function separateShips(world: World, ships: readonly Ship[]): void {
  for (let i = 0; i < ships.length; i++) {
    for (let j = i + 1; j < ships.length; j++) {
      const a = ships[i];
      const b = ships[j];
      if (a === undefined || b === undefined || rams(a, b)) continue;
      separatePair(world, a, b);
    }
  }
}

function separatePair(world: World, a: Ship, b: Ship): void {
  const minDist = hullRadius(world, a) + hullRadius(world, b);
  for (const ca of hullCircles(world, a)) {
    for (const cb of hullCircles(world, b)) {
      const dist = distance(ca, cb);
      if (dist >= minDist) continue;
      // Coincident centres: any axis works, pick +x deterministically.
      const normal: Vec2 = dist > 0 ? scale(sub(ca, cb), 1 / dist) : { x: 1, y: 0 };
      const push = scale(normal, (minDist - dist) * HALF);
      a.pos = add(a.pos, push);
      b.pos = sub(b.pos, push);
    }
  }
}

/** Pushes a ship's hull circles out of islands and back inside the arena. */
export function resolveStatic(world: World, ship: Ship): void {
  const radius = hullRadius(world, ship);
  const { width, height, islandRects } = world.arena;
  for (const rect of islandRects) {
    for (const circle of hullCircles(world, ship)) {
      const push = circleRectPushOut(circle, radius, rect);
      if (push) ship.pos = add(ship.pos, push);
    }
  }
  for (const circle of hullCircles(world, ship)) {
    const dx = Math.max(0, radius - circle.x) - Math.max(0, circle.x + radius - width);
    const dy = Math.max(0, radius - circle.y) - Math.max(0, circle.y + radius - height);
    ship.pos = add(ship.pos, { x: dx, y: dy });
  }
}
