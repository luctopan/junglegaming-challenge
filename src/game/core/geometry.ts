import type { Vec2 } from '../../shared/math/vec2';
import { dot, lengthSq, sub } from '../../shared/math/vec2';

/** Axis-aligned rectangle in world units. */
export interface Rect {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export const pointInRect = (p: Vec2, r: Rect): boolean =>
  p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY;

export const expandRect = (r: Rect, by: number): Rect => ({
  minX: r.minX - by,
  minY: r.minY - by,
  maxX: r.maxX + by,
  maxY: r.maxY + by,
});

/**
 * Smallest translation that moves a circle out of a rectangle, or `null` when
 * they do not overlap. A centre inside the rectangle exits through the nearest side.
 */
export function circleRectPushOut(center: Vec2, radius: number, r: Rect): Vec2 | null {
  const closestX = Math.min(r.maxX, Math.max(r.minX, center.x));
  const closestY = Math.min(r.maxY, Math.max(r.minY, center.y));
  const dx = center.x - closestX;
  const dy = center.y - closestY;
  const distSq = dx * dx + dy * dy;
  if (distSq > 0) {
    if (distSq >= radius * radius) return null;
    const dist = Math.sqrt(distSq);
    const depth = radius - dist;
    return { x: (dx / dist) * depth, y: (dy / dist) * depth };
  }
  const exits = [
    { x: -(center.x - r.minX + radius), y: 0 },
    { x: r.maxX - center.x + radius, y: 0 },
    { x: 0, y: -(center.y - r.minY + radius) },
    { x: 0, y: r.maxY - center.y + radius },
  ];
  return exits.reduce((best, exit) => (lengthSq(exit) < lengthSq(best) ? exit : best));
}

/**
 * Parameter t ∈ [0, 1] where segment a→b first touches the rectangle (slab
 * test), 0 when `a` is already inside, or `null` when it never does.
 */
export function segmentRectHit(a: Vec2, b: Vec2, r: Rect): number | null {
  let tMin = 0;
  let tMax = 1;
  const axes: readonly [number, number, number, number][] = [
    [a.x, b.x - a.x, r.minX, r.maxX],
    [a.y, b.y - a.y, r.minY, r.maxY],
  ];
  for (const [origin, delta, min, max] of axes) {
    if (delta === 0) {
      if (origin < min || origin > max) return null;
      continue;
    }
    const t1 = (min - origin) / delta;
    const t2 = (max - origin) / delta;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
    if (tMin > tMax) return null;
  }
  return tMin;
}

/**
 * Parameter t ∈ [0, 1] where segment a→b first touches the circle, 0 when `a`
 * is already inside, or `null` when it never does.
 */
export function segmentCircleHit(a: Vec2, b: Vec2, center: Vec2, radius: number): number | null {
  const f = sub(a, center);
  const c = lengthSq(f) - radius * radius;
  if (c <= 0) return 0;
  const d = sub(b, a);
  const aa = lengthSq(d);
  if (aa === 0) return null;
  // Half-b form of the quadratic |f + t·d|² = r².
  const halfB = dot(f, d);
  const disc = halfB * halfB - aa * c;
  if (disc < 0) return null;
  const t = (-halfB - Math.sqrt(disc)) / aa;
  return t >= 0 && t <= 1 ? t : null;
}

/** First hit of segment a→b against a list of rectangles grown by `padding`. */
export function firstRectHit(
  a: Vec2,
  b: Vec2,
  rects: readonly Rect[],
  padding: number,
): number | null {
  let best: number | null = null;
  for (const rect of rects) {
    const t = segmentRectHit(a, b, expandRect(rect, padding));
    if (t !== null && (best === null || t < best)) best = t;
  }
  return best;
}
