import { distance } from '../../../shared/math/vec2';
import type { DomainEvent } from '../events';
import { getPlayer, hullCircles, hullRadius } from '../ships';
import type { Ship, World } from '../types';
import { applyDamage, destroyShip } from './damage';

function touching(world: World, a: Ship, b: Ship): boolean {
  const reach = hullRadius(world, a) + hullRadius(world, b);
  return hullCircles(world, a).some((ca) =>
    hullCircles(world, b).some((cb) => distance(ca, cb) < reach),
  );
}

/** A Chaser touching the player explodes: ram damage to the player, no score. */
export function resolveRams(world: World, events: DomainEvent[]): void {
  const player = getPlayer(world);
  for (const ship of world.ships) {
    if (!player.alive) return;
    if (!ship.alive || ship.kind !== 'chaser' || !touching(world, ship, player)) continue;
    events.push({
      type: 'chaserRammed',
      time: world.elapsedSeconds,
      chaserId: ship.id,
      targetId: player.id,
      pos: ship.pos,
    });
    destroyShip(world, events, ship, 'ram', 'enemy');
    applyDamage(world, events, player, world.cfg.chaser.ramDamage, 'ram', 'enemy');
  }
}
