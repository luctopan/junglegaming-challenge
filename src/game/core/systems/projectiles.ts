import { EPSILON } from '../../../shared/math/constants';
import { add, length, lerp, scale } from '../../../shared/math/vec2';
import type { DomainEvent } from '../events';
import { firstRectHit, segmentCircleHit } from '../geometry';
import { hullCircles, hullRadius } from '../ships';
import type { Projectile, Ship, World } from '../types';
import { applyDamage } from './damage';

/**
 * Moves projectiles with a swept test (no tunnelling at any speed): the first
 * contact along the path wins. Projectiles only hit ships of the other team, so
 * enemy balls pass through enemy ships and player balls never hit the player.
 */
export function updateProjectiles(world: World, events: DomainEvent[], dt: number): void {
  for (const projectile of world.projectiles) {
    if (projectile.alive) moveProjectile(world, events, projectile, dt);
  }
}

function moveProjectile(world: World, events: DomainEvent[], p: Projectile, dt: number): void {
  const speed = length(p.vel);
  const travel = Math.min(speed * dt, p.distanceLeft);
  const start = p.pos;
  const end = add(start, scale(p.vel, travel / speed));
  const radius = world.cfg.projectile.radius;

  const islandT = firstRectHit(start, end, world.arena.islandRects, radius);
  const shipHit = firstShipHit(world, p, start, end, radius);

  if (shipHit && (islandT === null || shipHit.t <= islandT)) {
    p.alive = false;
    p.pos = lerp(start, end, shipHit.t);
    events.push({
      type: 'projectileHit',
      time: world.elapsedSeconds,
      projectileId: p.id,
      targetId: shipHit.ship.id,
      pos: p.pos,
    });
    applyDamage(world, events, shipHit.ship, p.damage, 'projectile', p.team);
    return;
  }
  if (islandT !== null) {
    p.alive = false;
    p.pos = lerp(start, end, islandT);
    events.push({
      type: 'projectileBlocked',
      time: world.elapsedSeconds,
      projectileId: p.id,
      pos: p.pos,
    });
    return;
  }

  p.pos = end;
  p.distanceLeft -= travel;
  const { width, height } = world.arena;
  const outside = end.x < 0 || end.y < 0 || end.x > width || end.y > height;
  if (outside || p.distanceLeft <= EPSILON) {
    p.alive = false;
    events.push({
      type: 'projectileExpired',
      time: world.elapsedSeconds,
      projectileId: p.id,
      pos: end,
      reason: outside ? 'outOfArena' : 'range',
    });
  }
}

function firstShipHit(
  world: World,
  p: Projectile,
  start: Projectile['pos'],
  end: Projectile['pos'],
  radius: number,
): { ship: Ship; t: number } | null {
  let best: { ship: Ship; t: number } | null = null;
  for (const ship of world.ships) {
    if (!ship.alive || ship.team === p.team) continue;
    const reach = hullRadius(world, ship) + radius;
    for (const circle of hullCircles(world, ship)) {
      const t = segmentCircleHit(start, end, circle, reach);
      if (t !== null && (best === null || t < best.t)) best = { ship, t };
    }
  }
  return best;
}
