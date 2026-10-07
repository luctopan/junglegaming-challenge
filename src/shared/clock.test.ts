import { describe, expect, it } from 'vitest';
import { ManualClock } from './clock';
import { cloneDeepFrozen } from './deepFreeze';

describe('ManualClock', () => {
  it('only moves when told to', () => {
    const clock = new ManualClock(100);
    expect(clock.now()).toBe(100);
    clock.advance(16.5);
    expect(clock.now()).toBe(116.5);
    clock.set(5);
    expect(clock.now()).toBe(5);
  });

  it('rejects negative or non-finite advances', () => {
    const clock = new ManualClock();
    expect(() => {
      clock.advance(-1);
    }).toThrow(RangeError);
    expect(() => {
      clock.advance(Number.NaN);
    }).toThrow(RangeError);
  });
});

describe('cloneDeepFrozen', () => {
  it('copies deeply and freezes every level', () => {
    const source = { a: { b: [1, { c: 2 }] }, d: 'x' };
    const copy = cloneDeepFrozen(source);
    source.a.b[0] = 99;
    expect(copy.a.b[0]).toBe(1);
    expect(Object.isFrozen(copy)).toBe(true);
    expect(Object.isFrozen(copy.a)).toBe(true);
    expect(Object.isFrozen(copy.a.b)).toBe(true);
    expect(Object.isFrozen(copy.a.b[1])).toBe(true);
  });
});
