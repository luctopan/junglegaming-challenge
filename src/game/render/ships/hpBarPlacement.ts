import type { Vec2 } from '../../../shared/math/vec2';
import type { Size } from '../viewport';

/** Half extents of a bar in world units. */
export interface BarExtents {
  readonly halfWidth: number;
  readonly halfHeight: number;
}

const clamp = (value: number, min: number, max: number): number =>
  min > max ? (min + max) / 2 : Math.min(max, Math.max(min, value));

/**
 * Centre of a ship's HP bar: `offset` above the ship, or as far below it when
 * the top edge has no room, then clamped so the whole bar stays inside the
 * arena (which `fitViewport` always shows in full). Ships hugging a wall keep
 * a readable bar instead of one cut by the screen edge.
 */
export function placeHpBar(ship: Vec2, bar: BarExtents, offset: number, arena: Size): Vec2 {
  const above = ship.y - offset;
  const y = above - bar.halfHeight >= 0 ? above : ship.y + offset;
  return {
    x: clamp(ship.x, bar.halfWidth, arena.width - bar.halfWidth),
    y: clamp(y, bar.halfHeight, arena.height - bar.halfHeight),
  };
}
