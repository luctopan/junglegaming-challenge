import { EPSILON } from '../../../shared/math/constants';
import type { DomainEvent } from '../events';
import { getPlayer } from '../ships';
import type { EndReason, World } from '../types';

/**
 * Ends the match when the player is destroyed or the session time is over.
 * Death is checked first: if HP reaches 0 on the very step the time runs out,
 * the reason is `defeated`. Returns whether the match is over.
 */
export function checkMatchEnd(world: World, events: DomainEvent[]): boolean {
  if (world.phase !== 'running') return true;
  const reason = endReason(world);
  if (reason === null) return false;
  world.phase = 'ended';
  world.endReason = reason;
  events.push({
    type: 'matchEnded',
    time: world.elapsedSeconds,
    reason,
    score: world.score,
  });
  return true;
}

function endReason(world: World): EndReason | null {
  if (!getPlayer(world).alive) return 'defeated';
  if (world.elapsedSeconds + EPSILON >= world.cfg.match.sessionSeconds) return 'time_up';
  return null;
}

export const timeLeftSeconds = (world: World): number =>
  Math.max(0, world.cfg.match.sessionSeconds - world.elapsedSeconds);

/** Removes expired wrecks (the player's wreck stays) and dead projectiles. */
export function cleanup(world: World, dt: number): void {
  for (const ship of world.ships) {
    if (!ship.alive) ship.wreckTimeLeft = Math.max(0, ship.wreckTimeLeft - dt);
  }
  world.ships = world.ships.filter(
    (s) => s.alive || s.id === world.playerId || s.wreckTimeLeft > 0,
  );
  world.projectiles = world.projectiles.filter((p) => p.alive);
}
