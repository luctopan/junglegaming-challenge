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

export interface CornerRadii {
  readonly topLeft: number;
  readonly topRight: number;
  readonly bottomLeft: number;
  readonly bottomRight: number;
}

/** Rectangle whose corners may be rounded (radius 0 = square corner). */
export interface RoundedRect extends Rect {
  readonly radii: CornerRadii;
}

export const SQUARE_CORNERS: CornerRadii = Object.freeze({
  topLeft: 0,
  topRight: 0,
  bottomLeft: 0,
  bottomRight: 0,
});

interface CornerCircle {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/**
 * The rounded corner whose quadrant contains `p`, if any. In that quadrant
 * (beyond both lines through the arc centre) the nearest point of the shape is
 * on the arc; everywhere else the plain rectangle gives the right answer.
 * Requires radii that fit the rect (validated in config).
 */
function cornerAt(p: Vec2, r: RoundedRect, grow = 0): CornerCircle | null {
  const { topLeft, topRight, bottomLeft, bottomRight } = r.radii;
  const corners: readonly [number, number, number, number, number][] = [
    // radius, centre x, centre y, x side (-1 left / 1 right), y side (-1 top / 1 bottom)
    [topLeft, r.minX + topLeft, r.minY + topLeft, -1, -1],
    [topRight, r.maxX - topRight, r.minY + topRight, 1, -1],
    [bottomLeft, r.minX + bottomLeft, r.maxY - bottomLeft, -1, 1],
    [bottomRight, r.maxX - bottomRight, r.maxY - bottomRight, 1, 1],
  ];
  for (const [radius, x, y, sx, sy] of corners) {
    if (radius > 0 && (p.x - x) * sx > 0 && (p.y - y) * sy > 0) {
      return { x, y, radius: radius + grow };
    }
  }
  return null;
}

/**
 * Push-out of a circle from a rounded rectangle. Near a rounded corner this is
 * circle vs circle (corner centre, corner radius + circle radius), elsewhere
 * the plain rectangle test.
 */
export function circleRoundedRectPushOut(
  center: Vec2,
  radius: number,
  r: RoundedRect,
): Vec2 | null {
  const corner = cornerAt(center, r);
  if (corner === null) return circleRectPushOut(center, radius, r);
  const dx = center.x - corner.x;
  const dy = center.y - corner.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const reach = corner.radius + radius;
  if (dist >= reach) return null;
  // `cornerAt` only matches strictly inside the quadrant, so dist > 0 here.
  const depth = reach - dist;
  return { x: (dx / dist) * depth, y: (dy / dist) * depth };
}

/**
 * Parameter t ∈ [0, 1] where segment a→b first touches the rounded rectangle
 * grown by `padding` (a moving circle of that radius), 0 when `a` already
 * touches it, or `null`. Exact because the shape is convex: a segment entering
 * the grown rectangle inside a corner quadrant either crosses that corner's arc
 * or leaves the rectangle again without touching the shape.
 */
export function segmentRoundedRectHit(
  a: Vec2,
  b: Vec2,
  r: RoundedRect,
  padding: number,
): number | null {
  const t = segmentRectHit(a, b, expandRect(r, padding));
  if (t === null) return null;
  const entry = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  const corner = cornerAt(entry, r, padding);
  return corner === null ? t : segmentCircleHit(a, b, corner, corner.radius);
}

/** First hit of segment a→b (a circle of radius `padding`) against rounded rectangles. */
export function firstRoundedRectHit(
  a: Vec2,
  b: Vec2,
  rects: readonly RoundedRect[],
  padding: number,
): number | null {
  let best: number | null = null;
  for (const rect of rects) {
    const t = segmentRoundedRectHit(a, b, rect, padding);
    if (t !== null && (best === null || t < best)) best = t;
  }
  return best;
}
