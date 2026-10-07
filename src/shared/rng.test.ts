import { describe, expect, it } from 'vitest';
import { createRng, nextFloat, nextRange, pickWeighted } from './rng';

const draw = (seed: number, n: number): number[] => {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => nextFloat(rng));
};

describe('rng', () => {
  it('is deterministic per seed and differs across seeds', () => {
    expect(draw(42, 20)).toEqual(draw(42, 20));
    expect(draw(42, 20)).not.toEqual(draw(43, 20));
  });

  it('keeps its whole state in a serializable number', () => {
    const rng = createRng(7);
    nextFloat(rng);
    const copy = JSON.parse(JSON.stringify(rng)) as typeof rng;
    expect(nextFloat(copy)).toBe(nextFloat(rng));
  });

  it('draws floats in [0, 1) and ranges in [min, max)', () => {
    const rng = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const f = nextFloat(rng);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const r = nextRange(rng, -5, 5);
      expect(r).toBeGreaterThanOrEqual(-5);
      expect(r).toBeLessThan(5);
    }
  });

  it('picks keys proportionally to their weights', () => {
    const rng = createRng(3);
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 10000; i++)
      counts[pickWeighted(rng, { a: 0.6, b: 0.4, c: 0 }, ['a', 'b', 'c'])]++;
    expect(counts.c).toBe(0);
    expect(counts.a / 10000).toBeCloseTo(0.6, 1);
  });

  it('rejects weights without a positive total', () => {
    expect(() => pickWeighted(createRng(1), { a: 0 }, ['a'])).toThrow(/positive/);
  });
});
