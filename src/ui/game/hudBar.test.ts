import { describe, expect, it } from 'vitest';
import { fillClipRight } from './hudBar';

describe('fillClipRight', () => {
  it('shows the whole fill rect at full HP and none at 0', () => {
    // Full: only the frame's right margin (256 − 30 − 196 = 30 px) is clipped.
    expect(fillClipRight(200, 200)).toBeCloseTo((30 / 256) * 100);
    expect(fillClipRight(0, 200)).toBeCloseTo((226 / 256) * 100);
  });

  it('is proportional in between and clamped outside', () => {
    expect(fillClipRight(100, 200)).toBeCloseTo(((256 - 30 - 98) / 256) * 100);
    expect(fillClipRight(300, 200)).toBe(fillClipRight(200, 200));
    expect(fillClipRight(-5, 200)).toBe(fillClipRight(0, 200));
    expect(fillClipRight(10, 0)).toBe(fillClipRight(0, 200));
  });
});
