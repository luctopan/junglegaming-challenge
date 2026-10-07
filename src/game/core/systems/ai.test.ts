import { describe, expect, it } from 'vitest';
import { distance } from '../../../shared/math/vec2';
import { hasLineOfSight, nextWaypoint, updateFlowField } from '../navigation/flowField';
import { getPlayer } from '../ships';
import { ofType, place, quietWorld, run, stepsFor } from '../testing/fixtures';
import { OPEN_MAP } from '../testing/maps';
import type { World } from '../types';

function withPlayerAt(world: World, x: number, y: number, heading = -Math.PI / 2): World {
  const player = getPlayer(world);
  player.pos = { x, y };
  player.heading = heading;
  return world;
}

/** Steps until the first event of `type` or the time limit; returns the elapsed time or null. */
function timeUntil(
  world: World,
  type: 'chaserRammed' | 'shotFired',
  seconds: number,
): number | null {
  for (let i = 0; i < stepsFor(world, seconds); i++) {
    if (ofType(run(world, 1), type).length > 0) return world.elapsedSeconds;
  }
  return null;
}

describe('Chaser', () => {
  it('pursues the player across open water and rams', () => {
    const world = quietWorld(undefined, { map: OPEN_MAP });
    place(world, 'chaser', { x: 100, y: 100 }, 0);
    expect(timeUntil(world, 'chaserRammed', 8)).not.toBeNull();
  });

  it('navigates around an island that blocks the direct line', () => {
    const world = quietWorld();
    const player = getPlayer(world);
    const chaser = place(world, 'chaser', { x: 448, y: 64 }, 0);
    expect(hasLineOfSight(world, chaser.pos, player.pos, 0)).toBe(false);
    expect(timeUntil(world, 'chaserRammed', 20)).not.toBeNull();
  });

  it('escapes a concave pocket to reach the player', () => {
    const world = withPlayerAt(quietWorld(), 960, 64);
    // Inside the "U" island's pocket, facing its closed end.
    place(world, 'chaser', { x: 320, y: 300 }, -Math.PI / 2);
    expect(timeUntil(world, 'chaserRammed', 25)).not.toBeNull();
  });
});

describe('Shooter', () => {
  it('approaches, holds at standoff distance and fires', () => {
    const world = withPlayerAt(quietWorld(undefined, { map: OPEN_MAP }), 850, 500);
    const shooter = place(world, 'shooter', { x: 200, y: 500 }, 0);
    const events = run(world, stepsFor(world, 8));
    const gap = distance(shooter.pos, getPlayer(world).pos);
    expect(gap).toBeLessThanOrEqual(world.cfg.shooter.standoffDistance + 10);
    expect(gap).toBeGreaterThan(world.cfg.shooter.standoffDistance - 40);
    expect(shooter.speed).toBeLessThan(5);
    expect(ofType(events, 'shotFired').length).toBeGreaterThan(1);
    expect(getPlayer(world).hp).toBeLessThan(100);
  });

  it('does not fire while out of range', () => {
    const world = withPlayerAt(quietWorld(undefined, { map: OPEN_MAP }), 850, 500);
    place(world, 'shooter', { x: 300, y: 500 }, 0);
    expect(timeUntil(world, 'shotFired', 0.5)).toBeNull();
  });

  it('does not fire without line of sight, even in range and aimed', () => {
    const world = withPlayerAt(quietWorld(), 690, 430, 0);
    const shooter = place(world, 'shooter', { x: 704, y: 140 }, Math.PI / 2);
    expect(distance(shooter.pos, getPlayer(world).pos)).toBeLessThan(300);
    expect(hasLineOfSight(world, shooter.pos, getPlayer(world).pos, 0)).toBe(false);
    expect(timeUntil(world, 'shotFired', 1)).toBeNull();
  });

  it('fires from the same spot when nothing blocks the line (control case)', () => {
    const world = withPlayerAt(quietWorld(undefined, { map: OPEN_MAP }), 690, 430, 0);
    place(world, 'shooter', { x: 704, y: 140 }, Math.PI / 2);
    expect(timeUntil(world, 'shotFired', 1)).not.toBeNull();
  });
});

describe('flow field', () => {
  it('is recomputed only when the player changes cell', () => {
    const world = quietWorld();
    run(world, 1);
    expect(world.nav.recomputeCount).toBe(1);
    run(world, 30);
    expect(world.nav.recomputeCount).toBe(1);
    getPlayer(world).pos = { x: 512 + 64, y: 448 };
    run(world, 1);
    expect(world.nav.recomputeCount).toBe(2);
  });

  it('leads out of the pocket through its opening', () => {
    const world = withPlayerAt(quietWorld(), 960, 64);
    updateFlowField(world);
    const waypoint = nextWaypoint(world, { x: 320, y: 300 });
    expect(waypoint?.y).toBeGreaterThan(300);
  });

  it('returns no waypoint inside the player cell and treats islands as impassable', () => {
    const world = quietWorld();
    updateFlowField(world);
    expect(nextWaypoint(world, getPlayer(world).pos)).toBeNull();
    const islandCells = world.nav.distances.filter(
      (d, i) => !world.arena.water[i] && d !== Infinity,
    );
    expect(islandCells).toEqual([]);
  });

  it('starts from neighbouring water when the player overlaps an island cell', () => {
    const world = withPlayerAt(quietWorld(), 140, 160);
    updateFlowField(world);
    expect(Math.min(...world.nav.distances)).toBe(0);
    expect(world.nav.distances.filter((d) => d === 0).length).toBeGreaterThan(0);
  });
});
