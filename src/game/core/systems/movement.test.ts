import { describe, expect, it } from 'vitest';
import { distance } from '../../../shared/math/vec2';
import { circleRoundedRectPushOut } from '../geometry';
import { getPlayer, hullCircles, hullRadius } from '../ships';
import { input, place, quietWorld, run, stepsFor } from '../testing/fixtures';
import { OPEN_MAP } from '../testing/maps';
import type { Ship, World } from '../types';

const open = (): World => quietWorld(undefined, { map: OPEN_MAP });

function overlapsIsland(world: World, ship: Ship): boolean {
  const r = hullRadius(world, ship);
  // Small tolerance: relaxation leaves sub-unit residual contact.
  return hullCircles(world, ship).some((c) =>
    world.arena.islandRects.some((rect) => {
      const push = circleRoundedRectPushOut(c, r - 0.5, rect);
      return push !== null;
    }),
  );
}

function insideArena(world: World, ship: Ship): boolean {
  const r = hullRadius(world, ship);
  return hullCircles(world, ship).every(
    (c) =>
      c.x >= r - 1e-6 &&
      c.y >= r - 1e-6 &&
      c.x <= world.arena.width - r + 1e-6 &&
      c.y <= world.arena.height - r + 1e-6,
  );
}

describe('movement', () => {
  it('accelerates forward up to max speed and moves along the heading', () => {
    const world = open();
    const player = getPlayer(world);
    player.heading = 0;
    player.pos = { x: 100, y: 500 };
    run(world, stepsFor(world, 0.5), input({ forward: true }));
    expect(player.speed).toBeCloseTo(80);
    run(world, stepsFor(world, 2), input({ forward: true }));
    expect(player.speed).toBe(140);
    expect(player.pos.y).toBeCloseTo(500);
    expect(player.pos.x).toBeGreaterThan(100 + 140 * 1.5);
  });

  it('decelerates to a stop without ever reversing', () => {
    const world = open();
    const player = getPlayer(world);
    player.heading = 0;
    player.pos = { x: 100, y: 500 };
    run(world, stepsFor(world, 1), input({ forward: true }));
    run(world, stepsFor(world, 3));
    expect(player.speed).toBe(0);
    const x = player.pos.x;
    run(world, 10);
    expect(player.pos.x).toBe(x);
  });

  it('rotates both ways at the configured turn rate, even when stopped', () => {
    const world = open();
    const player = getPlayer(world);
    const start = player.heading;
    run(world, stepsFor(world, 0.5), input({ turn: 1 }));
    expect(player.heading - start).toBeCloseTo((75 * Math.PI) / 180);
    run(world, stepsFor(world, 1), input({ turn: -1 }));
    expect(player.heading - start).toBeCloseTo((-75 * Math.PI) / 180);
    expect(player.speed).toBe(0);
  });
});

describe('collision', () => {
  it('keeps ships inside the visible arena', () => {
    const world = open();
    const player = getPlayer(world);
    player.heading = -Math.PI / 2;
    player.pos = { x: 100, y: 200 };
    run(world, stepsFor(world, 4), input({ forward: true }));
    expect(insideArena(world, player)).toBe(true);
    expect(player.pos.y).toBeCloseTo(
      hullRadius(world, player) + world.cfg.ships.player.hull.circleOffset,
    );
  });

  it('stops ships at islands and lets them slide along the shore', () => {
    const world = open();
    const player = getPlayer(world);
    // Heading up-right into the island bottom (y = 320) from below.
    player.pos = { x: 470, y: 450 };
    player.heading = -Math.PI / 3;
    for (let i = 0; i < stepsFor(world, 4); i++) {
      run(world, 1, input({ forward: true }));
      expect(overlapsIsland(world, player)).toBe(false);
    }
    // It slid past the island's right edge (x = 576) instead of sticking.
    expect(player.pos.x).toBeGreaterThan(576);
  });

  it('pushes overlapping ships apart, but not wrecks', () => {
    const world = open();
    const a = place(world, 'shooter', { x: 200, y: 500 }, 0);
    const b = place(world, 'shooter', { x: 210, y: 500 }, 0);
    run(world, 1);
    expect(distance(a.pos, b.pos)).toBeGreaterThan(30);
    const wreck = place(world, 'shooter', { x: a.pos.x, y: a.pos.y }, 0);
    wreck.alive = false;
    wreck.wreckTimeLeft = 10;
    const before = wreck.pos;
    run(world, 1);
    expect(wreck.pos).toEqual(before);
  });

  it('separates exactly coincident ships deterministically', () => {
    const world = open();
    const a = place(world, 'shooter', { x: 200, y: 500 }, Math.PI / 2);
    const b = place(world, 'shooter', { x: 200, y: 500 }, Math.PI / 2);
    run(world, 1);
    expect(a.pos.x).toBeGreaterThan(b.pos.x);
  });
});
