import type { CannonConfig } from '../../../config/gameConfig';
import { assertNever } from '../../../shared/assertNever';
import { EPSILON, HALF } from '../../../shared/math/constants';
import type { Vec2 } from '../../../shared/math/vec2';
import { add, fromAngle } from '../../../shared/math/vec2';
import type { DomainEvent } from '../events';
import type { CannonKind, Ship, WeaponSlot, World } from '../types';

const SLOTS: readonly WeaponSlot[] = ['front', 'left', 'right'];
const QUARTER_TURN = Math.PI * HALF;

/** Which cannon a ship kind has on a slot (`null` = none). */
export function cannonFor(ship: Ship, slot: WeaponSlot): CannonKind | null {
  switch (ship.kind) {
    case 'player':
      return slot === 'front' ? 'front' : 'broadside';
    case 'shooter':
      return slot === 'front' ? 'shooterCannon' : null;
    case 'chaser':
      return null;
    default:
      return assertNever(ship.kind, 'ship kind');
  }
}

/** Ticks cooldowns and fires every requested weapon that is ready. */
export function fireWeapons(world: World, events: DomainEvent[], dt: number): void {
  for (const ship of world.ships) {
    if (!ship.alive) continue;
    for (const slot of SLOTS) {
      ship.cooldowns[slot] = Math.max(0, ship.cooldowns[slot] - dt);
      const cannon = cannonFor(ship, slot);
      // EPSILON: a cooldown of n steps must be ready after exactly n steps despite rounding.
      if (cannon === null || !ship.control.fire[slot] || ship.cooldowns[slot] > EPSILON) continue;
      fire(world, events, ship, slot, cannon);
    }
  }
}

function fire(
  world: World,
  events: DomainEvent[],
  ship: Ship,
  slot: WeaponSlot,
  cannon: CannonKind,
): void {
  const stats: CannonConfig = world.cfg.weapons[cannon];
  ship.cooldowns[slot] = stats.cooldownSeconds;
  const direction = shotDirection(ship.heading, slot);
  const muzzles = muzzlePositions(world, ship, slot, cannon, direction);
  for (const muzzle of muzzles) {
    world.projectiles.push({
      id: world.nextId++,
      ownerId: ship.id,
      team: ship.team,
      cannon,
      pos: muzzle,
      prevPos: muzzle,
      vel: fromAngle(direction, stats.projectileSpeed),
      damage: stats.damage,
      distanceLeft: stats.projectileRange,
      alive: true,
    });
  }
  events.push({
    type: 'shotFired',
    time: world.elapsedSeconds,
    shipId: ship.id,
    slot,
    cannon,
    muzzles,
  });
}

/** Port (left) is a quarter turn counter-clockwise on screen (y down). */
export function shotDirection(heading: number, slot: WeaponSlot): number {
  switch (slot) {
    case 'front':
      return heading;
    case 'left':
      return heading - QUARTER_TURN;
    case 'right':
      return heading + QUARTER_TURN;
    default:
      return assertNever(slot, 'weapon slot');
  }
}

function muzzlePositions(
  world: World,
  ship: Ship,
  slot: WeaponSlot,
  cannon: CannonKind,
  direction: number,
): Vec2[] {
  const offset = fromAngle(direction, world.cfg.weapons[cannon].muzzleOffset);
  if (slot === 'front') return [add(ship.pos, offset)];
  const { count, spacing } = world.cfg.weapons.broadside;
  // Balls spread evenly along the hull, centred on the ship.
  return Array.from({ length: count }, (_, i) =>
    add(add(ship.pos, offset), fromAngle(ship.heading, (i - (count - 1) * HALF) * spacing)),
  );
}
