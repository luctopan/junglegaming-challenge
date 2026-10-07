import { describe, expect, it } from 'vitest';
import {
  circleRectPushOut,
  expandRect,
  firstRectHit,
  pointInRect,
  segmentCircleHit,
  segmentRectHit,
} from './geometry';

const rect = { minX: 0, minY: 0, maxX: 10, maxY: 10 };

describe('geometry', () => {
  it('tests points and grows rects', () => {
    expect(pointInRect({ x: 5, y: 5 }, rect)).toBe(true);
    expect(pointInRect({ x: 11, y: 5 }, rect)).toBe(false);
    expect(expandRect(rect, 2)).toEqual({ minX: -2, minY: -2, maxX: 12, maxY: 12 });
  });

  describe('circleRectPushOut', () => {
    it('returns null when apart or just touching', () => {
      expect(circleRectPushOut({ x: 15, y: 5 }, 4, rect)).toBeNull();
      expect(circleRectPushOut({ x: 14, y: 5 }, 4, rect)).toBeNull();
    });

    it('pushes along the contact normal for a centre outside', () => {
      const push = circleRectPushOut({ x: 12, y: 5 }, 4, rect);
      expect(push?.x).toBeCloseTo(2);
      expect(push?.y).toBeCloseTo(0);
    });

    it('pushes a centre inside out through the nearest side', () => {
      expect(circleRectPushOut({ x: 9, y: 5 }, 1, rect)).toEqual({ x: 2, y: 0 });
      expect(circleRectPushOut({ x: 5, y: 1 }, 1, rect)).toEqual({ x: 0, y: -2 });
    });
  });

  describe('segmentRectHit', () => {
    it('finds the entry parameter', () => {
      expect(segmentRectHit({ x: -10, y: 5 }, { x: 10, y: 5 }, rect)).toBeCloseTo(0.5);
    });

    it('returns 0 when starting inside and null on a miss', () => {
      expect(segmentRectHit({ x: 5, y: 5 }, { x: 50, y: 5 }, rect)).toBe(0);
      expect(segmentRectHit({ x: -10, y: 20 }, { x: 10, y: 20 }, rect)).toBeNull();
      expect(segmentRectHit({ x: -10, y: 5 }, { x: -5, y: 5 }, rect)).toBeNull();
      expect(segmentRectHit({ x: 20, y: -5 }, { x: 20, y: 15 }, rect)).toBeNull();
    });
  });

  describe('segmentCircleHit', () => {
    const center = { x: 10, y: 0 };
    it('finds the first contact', () => {
      expect(segmentCircleHit({ x: 0, y: 0 }, { x: 20, y: 0 }, center, 5)).toBeCloseTo(0.25);
    });

    it('handles inside starts, misses and degenerate segments', () => {
      expect(segmentCircleHit({ x: 9, y: 0 }, { x: 20, y: 0 }, center, 5)).toBe(0);
      expect(segmentCircleHit({ x: 0, y: 10 }, { x: 20, y: 10 }, center, 5)).toBeNull();
      expect(segmentCircleHit({ x: 0, y: 0 }, { x: 2, y: 0 }, center, 5)).toBeNull();
      expect(segmentCircleHit({ x: 0, y: 0 }, { x: 0, y: 0 }, center, 5)).toBeNull();
    });
  });

  it('firstRectHit returns the nearest padded hit', () => {
    const far = { minX: 50, minY: -5, maxX: 60, maxY: 5 };
    const near = { minX: 20, minY: -5, maxX: 30, maxY: 5 };
    expect(firstRectHit({ x: 0, y: 0 }, { x: 100, y: 0 }, [far, near], 0)).toBeCloseTo(0.2);
    expect(firstRectHit({ x: 0, y: 8 }, { x: 100, y: 8 }, [near], 0)).toBeNull();
    expect(firstRectHit({ x: 0, y: 8 }, { x: 100, y: 8 }, [near], 5)).toBeCloseTo(0.15);
  });
});
