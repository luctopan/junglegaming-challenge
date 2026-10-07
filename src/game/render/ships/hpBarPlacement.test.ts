import { describe, expect, it } from 'vitest';
import { placeHpBar } from './hpBarPlacement';

const ARENA = { width: 1024, height: 576 };
const BAR = { halfWidth: 32, halfHeight: 8 };
const OFFSET = 66;

describe('placeHpBar', () => {
  it('sits centred above the ship in open water', () => {
    expect(placeHpBar({ x: 500, y: 300 }, BAR, OFFSET, ARENA)).toEqual({ x: 500, y: 234 });
  });

  it('moves below the ship when there is no room above', () => {
    expect(placeHpBar({ x: 500, y: 40 }, BAR, OFFSET, ARENA)).toEqual({ x: 500, y: 106 });
    // Exactly enough room: stays above.
    expect(placeHpBar({ x: 500, y: OFFSET + BAR.halfHeight }, BAR, OFFSET, ARENA).y).toBe(
      BAR.halfHeight,
    );
  });

  it('is clamped inside the left and right edges', () => {
    expect(placeHpBar({ x: 5, y: 300 }, BAR, OFFSET, ARENA).x).toBe(BAR.halfWidth);
    expect(placeHpBar({ x: 1020, y: 300 }, BAR, OFFSET, ARENA).x).toBe(1024 - BAR.halfWidth);
  });

  it('keeps the whole bar inside the arena in every corner', () => {
    for (const ship of [
      { x: 0, y: 0 },
      { x: 1024, y: 0 },
      { x: 0, y: 576 },
      { x: 1024, y: 576 },
    ]) {
      const { x, y } = placeHpBar(ship, BAR, OFFSET, ARENA);
      expect(x - BAR.halfWidth).toBeGreaterThanOrEqual(0);
      expect(x + BAR.halfWidth).toBeLessThanOrEqual(ARENA.width);
      expect(y - BAR.halfHeight).toBeGreaterThanOrEqual(0);
      expect(y + BAR.halfHeight).toBeLessThanOrEqual(ARENA.height);
    }
  });

  it('centres a bar wider than the arena instead of producing NaN', () => {
    expect(placeHpBar({ x: 3, y: 300 }, { halfWidth: 600, halfHeight: 8 }, OFFSET, ARENA).x).toBe(
      512,
    );
  });
});
