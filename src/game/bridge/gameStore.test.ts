import { describe, expect, it, vi } from 'vitest';
import { createGameStore, toPercent } from './gameStore';

const match = { score: 0, secondsLeft: 120, hp: 200, maxHp: 200, endReason: null };

describe('gameStore', () => {
  it('notifies subscribers only when a displayed value changes', () => {
    const store = createGameStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.publishMatch(match);
    store.publishMatch({ ...match }); // same values, e.g. the next frame
    store.publishMatch({ ...match });
    expect(listener).toHaveBeenCalledTimes(1);

    store.publishMatch({ ...match, secondsLeft: 119 });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot().match?.secondsLeft).toBe(119);

    unsubscribe();
    store.publishMatch({ ...match, score: 1 });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('keeps the snapshot reference stable between changes (useSyncExternalStore)', () => {
    const store = createGameStore();
    store.setAssets({ kind: 'loading', percent: 10 });
    const snapshot = store.getSnapshot();
    store.setAssets({ kind: 'loading', percent: 10 });
    store.setPhase('loading');
    expect(store.getSnapshot()).toBe(snapshot);
    store.setAssets({ kind: 'error', message: 'offline' });
    expect(store.getSnapshot()).not.toBe(snapshot);
    store.setFailure('no WebGL');
    expect(store.getSnapshot().failure).toBe('no WebGL');
  });

  it('publishes the pause reason with the paused phase only', () => {
    const store = createGameStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.setPhase('paused', 'blur');
    expect(store.getSnapshot()).toMatchObject({ phase: 'paused', pauseReason: 'blur' });
    store.setPhase('paused', 'blur');
    expect(listener).toHaveBeenCalledTimes(1);
    store.setPhase('running', 'manual');
    expect(store.getSnapshot()).toMatchObject({ phase: 'running', pauseReason: null });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('reports loading progress in whole percent', () => {
    expect(toPercent(0.123)).toBe(12);
    expect(toPercent(1.4)).toBe(100);
    expect(toPercent(-1)).toBe(0);
  });
});
