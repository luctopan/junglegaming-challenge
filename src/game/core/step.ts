import type { DomainEvent } from './events';
import { getPlayer } from './ships';
import { updateEnemyAi } from './systems/ai';
import { resolveShipCollisions } from './systems/collision';
import { checkMatchEnd, cleanup } from './systems/match';
import { applyPlayerInput, moveShips } from './systems/movement';
import { updateProjectiles } from './systems/projectiles';
import { resolveRams } from './systems/ram';
import { updateSpawner } from './systems/spawner';
import { fireWeapons } from './systems/weapons';
import type { PlayerInput, World } from './types';

/**
 * Advances the match by exactly one fixed step (`cfg.simulation.stepSeconds`)
 * and returns what happened. Mutates only `world`; randomness comes from
 * `world.rng`. Once the match has ended this is a no-op, which freezes
 * movement, attacks, damage, spawns and score.
 */
export function step(world: World, input: PlayerInput): DomainEvent[] {
  const events: DomainEvent[] = [];
  if (world.phase !== 'running') return events;
  const dt = world.cfg.simulation.stepSeconds;

  world.stepCount += 1;
  world.elapsedSeconds = world.stepCount * dt;
  for (const ship of world.ships) {
    ship.prevPos = ship.pos;
    ship.prevHeading = ship.heading;
  }
  for (const projectile of world.projectiles) projectile.prevPos = projectile.pos;

  const player = getPlayer(world);
  if (player.alive) applyPlayerInput(player, input);
  updateEnemyAi(world, dt);
  moveShips(world, dt);
  resolveRams(world, events);
  resolveShipCollisions(world);
  fireWeapons(world, events, dt);
  updateProjectiles(world, events, dt);
  cleanup(world, dt);
  const ended = checkMatchEnd(world, events);
  if (!ended) updateSpawner(world, events);
  return events;
}
