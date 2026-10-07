import type { Vec2 } from '../../../shared/math/vec2';
import { firstRectHit } from '../geometry';
import { cellCenter, cellIndexAt, isWaterCell } from '../map/arena';
import { getPlayer } from '../ships';
import type { Arena, World } from '../types';

const ORTHOGONAL: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const DIAGONAL: readonly [number, number][] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/**
 * Keeps the BFS distance field towards the player's cell up to date. It is
 * recomputed only when the player enters another cell (cheap: 144 cells).
 */
export function updateFlowField(world: World): void {
  const source = cellIndexAt(world.arena, getPlayer(world).pos);
  if (source === world.nav.sourceCell) return;
  world.nav.distances = computeDistances(world.arena, source);
  world.nav.sourceCell = source;
  world.nav.recomputeCount += 1;
}

function computeDistances(arena: Arena, source: number): number[] {
  const distances = arena.water.map(() => Number.POSITIVE_INFINITY);
  const col = source % arena.cols;
  const row = Math.floor(source / arena.cols);
  // A player hugging a shore may stand over an island cell: start from its water neighbours.
  const seeds = isWaterCell(arena, col, row)
    ? [source]
    : [...ORTHOGONAL, ...DIAGONAL]
        .filter(([dc, dr]) => isWaterCell(arena, col + dc, row + dr))
        .map(([dc, dr]) => (row + dr) * arena.cols + col + dc);
  const queue: number[] = [];
  for (const seed of seeds) {
    distances[seed] = 0;
    queue.push(seed);
  }
  // Array iteration also visits the cells pushed during the loop (BFS order).
  for (const index of queue) {
    const c = index % arena.cols;
    const r = Math.floor(index / arena.cols);
    const next = (distances[index] ?? 0) + 1;
    for (const [dc, dr] of ORTHOGONAL) {
      const n = (r + dr) * arena.cols + c + dc;
      if (isWaterCell(arena, c + dc, r + dr) && (distances[n] ?? 0) > next) {
        distances[n] = next;
        queue.push(n);
      }
    }
  }
  return distances;
}

/**
 * Centre of the neighbouring water cell closest to the player along the flow
 * field, or `null` when already in the player's cell (or no route exists).
 * Diagonal moves require both orthogonal cells to be water (no corner cutting).
 */
export function nextWaypoint(world: World, pos: Vec2): Vec2 | null {
  const { arena, nav } = world;
  const here = cellIndexAt(arena, pos);
  const col = here % arena.cols;
  const row = Math.floor(here / arena.cols);
  let best = here;
  let bestDistance = nav.distances[here] ?? Number.POSITIVE_INFINITY;
  const consider = (dc: number, dr: number): void => {
    if (!isWaterCell(arena, col + dc, row + dr)) return;
    const index = (row + dr) * arena.cols + col + dc;
    const d = nav.distances[index] ?? Number.POSITIVE_INFINITY;
    if (d < bestDistance) {
      best = index;
      bestDistance = d;
    }
  };
  for (const [dc, dr] of ORTHOGONAL) consider(dc, dr);
  for (const [dc, dr] of DIAGONAL) {
    if (isWaterCell(arena, col + dc, row) && isWaterCell(arena, col, row + dr)) consider(dc, dr);
  }
  return best === here ? null : cellCenter(arena, best);
}

/** True when the segment, thickened by `padding`, crosses no island. */
export const hasLineOfSight = (world: World, from: Vec2, to: Vec2, padding: number): boolean =>
  firstRectHit(from, to, world.arena.islandRects, padding) === null;
