import type { EnemyKind } from '../../../config/gameConfig';
import { ENEMY_KINDS } from '../../../config/gameConfig';
import { EPSILON } from '../../../shared/math/constants';
import type { Vec2 } from '../../../shared/math/vec2';
import { angleOf, distance, sub } from '../../../shared/math/vec2';
import { nextFloat, pickWeighted } from '../../../shared/rng';
import type { DomainEvent } from '../events';
import { circleRectPushOut } from '../geometry';
import { addShip, aliveEnemies, getPlayer, hullCircles, hullRadius } from '../ships';
import type { World } from '../types';

/**
 * Spawns enemies on a cadence anchored to `n × interval`. A due spawn is never
 * dropped: while it cannot be placed (alive cap, no free point within this
 * step's attempt budget) it stays pending and is retried on the next steps,
 * without shifting later spawn times.
 */
export function updateSpawner(world: World, events: DomainEvent[]): void {
  const { spawner } = world;
  if (!spawner.enabled) return;
  const { attemptsPerStep, maxAliveEnemies } = world.cfg.spawn;
  let attempts = 0;
  while (pendingSpawns(world) > 0 && attempts < attemptsPerStep) {
    if (aliveEnemies(world).length >= maxAliveEnemies) return;
    attempts += 1;
    const point = randomEdgePoint(world);
    if (!isClear(world, point)) continue;
    spawnEnemy(world, events, point);
  }
}

/** Spawns due so far and not yet placed. */
export function pendingSpawns(world: World): number {
  const due = Math.floor((world.elapsedSeconds + EPSILON) / world.cfg.spawn.intervalSeconds);
  return due - world.spawner.spawned;
}

function spawnEnemy(world: World, events: DomainEvent[], pos: Vec2): void {
  const kind = chooseKind(world);
  const heading = angleOf(sub(getPlayer(world).pos, pos));
  const ship = addShip(world, kind, pos, heading);
  world.spawner.spawned += 1;
  world.spawner.spawnedByKind[kind] += 1;
  events.push({ type: 'enemySpawned', time: world.elapsedSeconds, shipId: ship.id, kind, pos });
}

function chooseKind(world: World): EnemyKind {
  const { weights, guaranteeEachKindInFirstTwo } = world.cfg.spawn;
  if (guaranteeEachKindInFirstTwo && world.spawner.spawned === 1) {
    const missing = ENEMY_KINDS.find((kind) => world.spawner.spawnedByKind[kind] === 0);
    if (missing) return missing;
  }
  return pickWeighted(world.rng, weights, ENEMY_KINDS);
}

/** Uniform point on the rectangle `edgeInset` inside the arena border. */
function randomEdgePoint(world: World): Vec2 {
  const inset = world.cfg.spawn.edgeInset;
  const w = world.arena.width - inset - inset;
  const h = world.arena.height - inset - inset;
  let s = nextFloat(world.rng) * (w + h + w + h);
  if (s < w) return { x: inset + s, y: inset };
  s -= w;
  if (s < h) return { x: inset + w, y: inset + s };
  s -= h;
  if (s < w) return { x: inset + w - s, y: inset + h };
  s -= w;
  return { x: inset, y: inset + h - s };
}

/** Far enough from the player, clear of islands and of every ship (wrecks included). */
function isClear(world: World, point: Vec2): boolean {
  const { clearanceRadius, minDistanceFromPlayer } = world.cfg.spawn;
  if (distance(point, getPlayer(world).pos) < minDistanceFromPlayer) return false;
  if (world.arena.islandRects.some((r) => circleRectPushOut(point, clearanceRadius, r) !== null)) {
    return false;
  }
  return world.ships.every((ship) =>
    hullCircles(world, ship).every(
      (c) => distance(c, point) >= clearanceRadius + hullRadius(world, ship),
    ),
  );
}
