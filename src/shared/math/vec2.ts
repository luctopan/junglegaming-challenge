/** Plain 2D vector; functions never mutate their arguments. */
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export const vec2 = (x: number, y: number): Vec2 => ({ x, y });

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });

export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });

export const scale = (v: Vec2, k: number): Vec2 => ({ x: v.x * k, y: v.y * k });

export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;

export const lengthSq = (v: Vec2): number => v.x * v.x + v.y * v.y;

export const length = (v: Vec2): number => Math.sqrt(lengthSq(v));

export const distance = (a: Vec2, b: Vec2): number => length(sub(a, b));

/** Unit vector pointing at `angle` (radians, y axis down). */
export const fromAngle = (angle: number, len = 1): Vec2 => ({
  x: Math.cos(angle) * len,
  y: Math.sin(angle) * len,
});

export const angleOf = (v: Vec2): number => Math.atan2(v.y, v.x);

/** Linear interpolation between two points, `t` in [0, 1]. */
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
