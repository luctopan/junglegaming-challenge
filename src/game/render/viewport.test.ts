import { describe, expect, it } from 'vitest';
import { createPose, interpolatePose } from './interpolate';
import { createPool } from './pool';
import {
  fitViewport,
  preferredTextureResolution,
  screenToWorld,
  visibleWorldRect,
  worldToScreen,
} from './viewport';

const ARENA = { width: 1024, height: 576 };

describe('fitViewport', () => {
  it('fits the whole arena and preserves its aspect ratio', () => {
    const wide = fitViewport({ width: 2400, height: 600 }, ARENA);
    expect(wide.scale).toBeCloseTo(600 / 576);
    expect(wide.offsetY).toBe(0);
    expect(wide.offsetX).toBeCloseTo((2400 - 1024 * wide.scale) / 2);

    const tall = fitViewport({ width: 800, height: 900 }, ARENA);
    expect(tall.scale).toBeCloseTo(800 / 1024);
    expect(tall.offsetX).toBe(0);
  });

  it('maps screen points back to world points (input coordinates)', () => {
    const viewport = fitViewport({ width: 1280, height: 720 }, ARENA);
    for (const point of [
      { x: 0, y: 0 },
      { x: 1024, y: 576 },
      { x: 300.5, y: 41 },
    ]) {
      const back = screenToWorld(viewport, worldToScreen(viewport, point));
      expect(back.x).toBeCloseTo(point.x);
      expect(back.y).toBeCloseTo(point.y);
    }
    // Arena corners land inside the screen: the bounds are always fully visible.
    expect(worldToScreen(viewport, { x: 1024, y: 576 })).toEqual({ x: 1280, y: 720 });
  });

  it('covers the letterbox with the visible world rect', () => {
    const viewport = fitViewport({ width: 915, height: 412 }, ARENA);
    const rect = visibleWorldRect(viewport);
    expect(rect.x).toBeLessThan(0);
    expect(rect.x + rect.width).toBeGreaterThan(1024);
    expect(rect.y).toBeCloseTo(0);
  });

  it('copes with an empty container', () => {
    const viewport = fitViewport({ width: 0, height: 0 }, ARENA);
    expect(viewport.scale).toBe(0);
    expect(screenToWorld(viewport, { x: 5, y: 5 })).toEqual({ x: 0, y: 0 });
  });

  it('prefers 2× art once a world unit covers more than one device pixel', () => {
    expect(preferredTextureResolution(1, 0.9)).toBe(1);
    expect(preferredTextureResolution(1, 1.25)).toBe(2);
    expect(preferredTextureResolution(2, 0.6)).toBe(2);
  });
});

describe('interpolatePose', () => {
  it('blends position and takes the short way round for headings', () => {
    const pose = createPose();
    interpolatePose(pose, { x: 0, y: 0 }, { x: 10, y: -4 }, 3, -3, 0.5);
    expect(pose.x).toBe(5);
    expect(pose.y).toBe(-2);
    // 3 rad → -3 rad is a small turn through ±π, not a 6 rad spin.
    expect(Math.abs(pose.heading - 3)).toBeLessThan(0.2);
  });
});

describe('createPool', () => {
  it('reuses released items and destroys every item once', () => {
    let created = 0;
    const disposed: number[] = [];
    const pool = createPool({
      create: () => ({ id: created++, live: true }),
      reset: (item) => {
        item.live = false;
      },
      dispose: (item) => disposed.push(item.id),
    });
    const a = pool.acquire();
    const b = pool.acquire();
    pool.release(a);
    pool.release(a); // double release is ignored
    expect(pool.acquire()).toBe(a);
    expect([pool.active, pool.created]).toEqual([2, 2]);
    pool.release(b);
    pool.destroy();
    expect(disposed.sort()).toEqual([0, 1]);
  });
});
