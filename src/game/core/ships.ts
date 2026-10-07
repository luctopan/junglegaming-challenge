import type { Vec2 } from '../../shared/math/vec2';
import { add, fromAngle } from '../../shared/math/vec2';
import type { ShipKind, Ship, World } from './types';

/** Bow and stern collision circle centres. */
export function hullCircles(world: World, ship: Ship): readonly [Vec2, Vec2] {
  const { circleOffset } = world.cfg.ships[ship.kind].hull;
  return [
    add(ship.pos, fromAngle(ship.heading, circleOffset)),
    add(ship.pos, fromAngle(ship.heading, -circleOffset)),
  ];
}

export const hullRadius = (world: World, ship: Ship): number =>
  world.cfg.ships[ship.kind].hull.circleRadius;

export function addShip(world: World, kind: ShipKind, pos: Vec2, heading: number): Ship {
  const stats = world.cfg.ships[kind];
  const ship: Ship = {
    id: world.nextId++,
    kind,
    team: kind === 'player' ? 'player' : 'enemy',
    pos,
    prevPos: pos,
    heading,
    prevHeading: heading,
    speed: 0,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    alive: true,
    wreckTimeLeft: 0,
    cooldowns: { front: 0, left: 0, right: 0 },
    control: { throttle: 0, turn: 0, fire: { front: false, left: false, right: false } },
  };
  world.ships.push(ship);
  return ship;
}

export function getPlayer(world: World): Ship {
  const player = world.ships.find((s) => s.id === world.playerId);
  // The player ship is created with the world and never removed (its wreck stays).
  if (!player) throw new Error('World has no player ship');
  return player;
}

export const aliveEnemies = (world: World): Ship[] =>
  world.ships.filter((s) => s.alive && s.team === 'enemy');
