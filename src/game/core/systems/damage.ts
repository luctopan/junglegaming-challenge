import type { DomainEvent } from '../events';
import type { Ship, Team, World } from '../types';

export type DamageCause = 'projectile' | 'ram';

/**
 * Applies damage once. Dead ships ignore further damage, so a ship can be
 * destroyed (and scored) only once even if several hits land in one step.
 */
export function applyDamage(
  world: World,
  events: DomainEvent[],
  target: Ship,
  amount: number,
  cause: DamageCause,
  sourceTeam: Team,
): void {
  if (!target.alive || world.phase !== 'running') return;
  target.hp = Math.max(0, target.hp - amount);
  events.push({
    type: 'shipDamaged',
    time: world.elapsedSeconds,
    shipId: target.id,
    amount,
    hp: target.hp,
  });
  if (target.hp === 0) destroyShip(world, events, target, cause, sourceTeam);
}

/** Turns a ship into a non-colliding wreck; +1 score only for player projectile kills. */
export function destroyShip(
  world: World,
  events: DomainEvent[],
  ship: Ship,
  cause: DamageCause,
  killerTeam: Team,
): void {
  if (!ship.alive) return;
  ship.alive = false;
  ship.hp = 0;
  ship.speed = 0;
  ship.wreckTimeLeft = world.cfg.damage.wreckSeconds;
  events.push({
    type: 'shipDestroyed',
    time: world.elapsedSeconds,
    shipId: ship.id,
    kind: ship.kind,
    cause,
    killerTeam,
    pos: ship.pos,
  });
  if (cause === 'projectile' && killerTeam === 'player' && ship.team === 'enemy') {
    world.score += 1;
    events.push({ type: 'scoreChanged', time: world.elapsedSeconds, score: world.score });
  }
}
