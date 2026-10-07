import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG } from '../../config/defaults';
import { cloneDeepFrozen } from '../../shared/deepFreeze';
import { add, length } from '../../shared/math/vec2';
import type { RoundedRect } from './geometry';
import {
  circleRoundedRectPushOut,
  firstRoundedRectHit,
  SQUARE_CORNERS,
  segmentRoundedRectHit,
} from './geometry';
import { buildArena } from './map/arena';
import { ARENA_MAP } from './map/arenaMap';
import { shoreShape } from './map/shoreShape';
import { createMatch } from './createMatch';
import { step } from './step';
import { IDLE_INPUT } from './types';

const R = 20;
/** 100×100 block whose top-left corner is rounded. */
const block: RoundedRect = {
  minX: 0,
  minY: 0,
  maxX: 100,
  maxY: 100,
  radii: { ...SQUARE_CORNERS, topLeft: R },
};
const DIAGONAL = Math.SQRT1_2;

describe('circle vs rounded rect', () => {
  it('lets a circle sit in the space a square corner would block', () => {
    // On the diagonal, 3 u outside the arc: a square corner would overlap.
    const d = R + 3 + 5;
    const center = { x: R - d * DIAGONAL, y: R - d * DIAGONAL };
    expect(circleRoundedRectPushOut(center, 5, block)).toBeNull();
    expect(circleRoundedRectPushOut(center, 5, { ...block, radii: SQUARE_CORNERS })).not.toBeNull();
  });

  it('pushes a circle overlapping the arc out along the corner normal, to exact contact', () => {
    const center = { x: R - 20 * DIAGONAL, y: R - 20 * DIAGONAL };
    const push = circleRoundedRectPushOut(center, 5, block);
    expect(push).not.toBeNull();
    if (push === null) return;
    expect(push.x).toBeCloseTo(-5 * DIAGONAL);
    expect(push.y).toBeCloseTo(-5 * DIAGONAL);
    const after = add(center, push);
    expect(length({ x: after.x - R, y: after.y - R })).toBeCloseTo(R + 5);
  });

  it('keeps straight sides square-exact outside the corner quadrant', () => {
    expect(circleRoundedRectPushOut({ x: 50, y: -4 }, 5, block)).toEqual({ x: 0, y: -1 });
    expect(circleRoundedRectPushOut({ x: -4, y: 50 }, 5, block)).toEqual({ x: -1, y: 0 });
  });
});

describe('projectile vs rounded rect', () => {
  it('lets a ball graze past a rounded corner that a square one would block', () => {
    // Path tangent-parallel to the corner, R + 6 from the arc centre: a ball of
    // radius 5 misses the arc by 1 u, but would clip the square corner.
    const closest = { x: R - (R + 6) * DIAGONAL, y: R - (R + 6) * DIAGONAL };
    const start = { x: closest.x - 80 * DIAGONAL, y: closest.y + 80 * DIAGONAL };
    const end = { x: closest.x + 80 * DIAGONAL, y: closest.y - 80 * DIAGONAL };
    expect(segmentRoundedRectHit(start, end, block, 5)).toBeNull();
    expect(
      segmentRoundedRectHit(start, end, { ...block, radii: SQUARE_CORNERS }, 5),
    ).not.toBeNull();
  });

  it('hits the arc where it touches it, not the bounding square', () => {
    const start = { x: -50, y: -50 };
    const end = { x: 50, y: 50 };
    const t = segmentRoundedRectHit(start, end, block, 5);
    expect(t).not.toBeNull();
    if (t === null) return;
    const hit = { x: -50 + 100 * t, y: -50 + 100 * t };
    expect(length({ x: hit.x - R, y: hit.y - R })).toBeCloseTo(R + 5);
  });

  it('starting inside the shape is an immediate hit; inside the empty corner it is not', () => {
    expect(segmentRoundedRectHit({ x: 50, y: 50 }, { x: 60, y: 60 }, block, 0)).toBe(0);
    // (1, 1) lies in the bounding square but outside the arc, moving away.
    expect(segmentRoundedRectHit({ x: 1, y: 1 }, { x: -9, y: -9 }, block, 0)).toBeNull();
  });
});

describe('default arena corners', () => {
  const tile = DEFAULT_GAME_CONFIG.arena.tileSize;
  const radius = DEFAULT_GAME_CONFIG.arena.islandCornerRadius;
  const arena = buildArena(ARENA_MAP, tile, 0, radius);

  it('rounds convex shore corners only; junctions between rects stay square', () => {
    // U island: top bar (rows 2–3) has rounded top corners; its bottom corners meet the arms.
    const bar = arena.islandRects.find((r) => r.minY === 2 * tile && r.minX === 2 * tile);
    expect(bar?.radii).toEqual({
      topLeft: radius,
      topRight: radius,
      bottomLeft: 0,
      bottomRight: 0,
    });
    const leftArm = arena.islandRects.find((r) => r.minY === 4 * tile && r.minX === 2 * tile);
    expect(leftArm?.radii).toEqual({
      topLeft: 0,
      topRight: 0,
      bottomLeft: radius,
      bottomRight: radius,
    });
    // L island middle rect (rows 4–5, cols 10–13): its top side is half covered by
    // the rect above, yet its top-right cell is a real shore corner, and so is its bottom-left.
    const middle = arena.islandRects.find((r) => r.minY === 4 * tile && r.minX === 10 * tile);
    expect(middle?.radii).toEqual({
      topLeft: 0,
      topRight: radius,
      bottomLeft: radius,
      bottomRight: 0,
    });
  });

  it('rounds exactly the cells drawn with outer-corner tiles', () => {
    const solid = (col: number, row: number) => ARENA_MAP[row]?.[col] === '#';
    const roundedCorners = arena.islandRects.reduce(
      (n, r) => n + Object.values(r.radii).filter((v) => v > 0).length,
      0,
    );
    let outerCornerCells = 0;
    ARENA_MAP.forEach((line, row) => {
      Array.from(line).forEach((_, col) => {
        if (solid(col, row) && shoreShape(solid, col, row).kind === 'outerCorner')
          outerCornerCells++;
      });
    });
    expect(roundedCorners).toBe(outerCornerCells);
  });

  it('no ball tunnels through the junction of two rects of one island', () => {
    // Straight down column 2 of the U: crosses the bar/arm junction at y = 4 tiles.
    const blockedEverywhere = [0.1, 0.5, 0.9].every((f) => {
      const x = (2 + f) * tile;
      return (
        firstRoundedRectHit({ x, y: 3.5 * tile }, { x, y: 5.5 * tile }, arena.islandRects, 5) === 0
      );
    });
    expect(blockedEverywhere).toBe(true);
    // Along the junction line from the open pocket side: blocked at the shore.
    const t = firstRoundedRectHit(
      { x: 5 * tile, y: 4 * tile + 1 },
      { x: 3 * tile, y: 4 * tile + 1 },
      arena.islandRects,
      5,
    );
    expect(t).not.toBeNull();
  });

  it('a ship pressed into a convex corner rests on the arc (art gap ≤ a few units)', () => {
    const cfg = cloneDeepFrozen({
      ...DEFAULT_GAME_CONFIG,
      // Player spawned facing the U island's top-left corner from the diagonal.
      playerSpawn: { x: 2 * tile - 40, y: 2 * tile - 40, headingDeg: 45 },
    });
    const world = createMatch(cfg, 1, { spawnEnemies: false });
    for (let i = 0; i < 180; i++) step(world, { ...IDLE_INPUT, forward: true });
    const player = world.ships[0];
    if (player === undefined) throw new Error('no player');
    const centre = { x: 2 * tile + radius, y: 2 * tile + radius };
    const hull = DEFAULT_GAME_CONFIG.ships.player.hull;
    const bow = {
      x: player.pos.x + Math.cos(player.heading) * hull.circleOffset,
      y: player.pos.y + Math.sin(player.heading) * hull.circleOffset,
    };
    // Bow circle touches the arc: distance to the arc centre = corner radius + hull radius.
    expect(length({ x: bow.x - centre.x, y: bow.y - centre.y })).toBeGreaterThanOrEqual(
      radius + hull.circleRadius - 0.5,
    );
    // …and it got further into the corner than a square corner would allow.
    expect(Math.max(bow.x - 2 * tile, bow.y - 2 * tile)).toBeGreaterThan(-hull.circleRadius);
  });
});
