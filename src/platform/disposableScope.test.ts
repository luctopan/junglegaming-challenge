import { describe, expect, it, vi } from 'vitest';
import { DisposableScope } from './disposableScope';
import { resourceCounts, trackResource } from './resourceCounters';
import { isTestMode } from './testMode';

describe('DisposableScope', () => {
  it('removes listeners on dispose and counts them while alive', () => {
    const target = new EventTarget();
    const listener = vi.fn();
    const before = resourceCounts().listeners;
    const scope = new DisposableScope();
    scope.listen(target, 'ping', listener);
    expect(resourceCounts().listeners).toBe(before + 1);

    target.dispatchEvent(new Event('ping'));
    scope.dispose();
    target.dispatchEvent(new Event('ping'));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(resourceCounts().listeners).toBe(before);
  });

  it('disposes in reverse order, once, and releases late additions immediately', () => {
    const order: string[] = [];
    const scope = new DisposableScope();
    scope.add(() => order.push('first'));
    scope.add(() => order.push('second'));
    scope.dispose();
    scope.dispose();
    expect(order).toEqual(['second', 'first']);

    scope.add(() => order.push('late'));
    expect(order).toEqual(['second', 'first', 'late']);
    const target = new EventTarget();
    scope.listen(target, 'x', () => undefined);
    expect(scope.disposed).toBe(true);
  });

  it('runs every step even if one throws, then reports the failure', () => {
    const scope = new DisposableScope();
    const after = vi.fn();
    scope.add(after);
    scope.add(() => {
      throw new Error('boom');
    });
    expect(() => {
      scope.dispose();
    }).toThrow('boom');
    expect(after).toHaveBeenCalled();
  });
});

describe('trackResource', () => {
  it('releases a resource exactly once', () => {
    const before = resourceCounts().tickerCallbacks;
    const release = trackResource('tickerCallbacks');
    release();
    release();
    expect(resourceCounts().tickerCallbacks).toBe(before);
  });
});

describe('isTestMode', () => {
  it('is on only for ?test=1', () => {
    expect(isTestMode('?test=1&seed=4')).toBe(true);
    expect(isTestMode('?test=0')).toBe(false);
    expect(isTestMode('')).toBe(false);
  });
});
