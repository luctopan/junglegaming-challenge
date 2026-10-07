import { describe, expect, it } from 'vitest';
import { angleDelta, clamp, toRadians, wrapAngle } from './angle';
import { add, angleOf, distance, dot, fromAngle, length, lerp, scale, sub, vec2 } from './vec2';

describe('angle', () => {
  it('converts degrees to radians', () => {
    expect(toRadians(180)).toBeCloseTo(Math.PI);
    expect(toRadians(-90)).toBeCloseTo(-Math.PI / 2);
  });

  it('wraps into (-π, π]', () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(-Math.PI)).toBe(Math.PI);
    expect(wrapAngle((-3 * Math.PI) / 2)).toBeCloseTo(Math.PI / 2);
    expect(wrapAngle(0.5)).toBe(0.5);
  });

  it('gives the shortest signed rotation', () => {
    expect(angleDelta(toRadians(170), toRadians(-170))).toBeCloseTo(toRadians(20));
    expect(angleDelta(toRadians(-170), toRadians(170))).toBeCloseTo(toRadians(-20));
  });

  it('clamps', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
});

describe('vec2', () => {
  it('does basic arithmetic without mutation', () => {
    const a = vec2(1, 2);
    const b = vec2(3, -1);
    expect(add(a, b)).toEqual({ x: 4, y: 1 });
    expect(sub(a, b)).toEqual({ x: -2, y: 3 });
    expect(scale(a, 2)).toEqual({ x: 2, y: 4 });
    expect(dot(a, b)).toBe(1);
    expect(length(vec2(3, 4))).toBe(5);
    expect(distance(a, a)).toBe(0);
    expect(lerp(a, b, 0.5)).toEqual({ x: 2, y: 0.5 });
    expect(a).toEqual({ x: 1, y: 2 });
  });

  it('round-trips angles with y pointing down', () => {
    const down = fromAngle(Math.PI / 2, 2);
    expect(down.x).toBeCloseTo(0);
    expect(down.y).toBeCloseTo(2);
    expect(angleOf(down)).toBeCloseTo(Math.PI / 2);
  });
});
