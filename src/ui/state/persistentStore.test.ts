import { describe, expect, it, vi } from 'vitest';
import { parsePlayerOptions } from '../../config/options';
import type { KeyValueStorage } from '../../platform/storage';
import { memoryStorage } from '../../platform/storage';
import { parseMatchSubmission } from '../../api/matchSubmission';
import { createPersistentStore } from './persistentStore';

const KEY = 'pirate.options.v1';
const DEFAULTS = { sessionSeconds: 120, spawnIntervalSeconds: 3 };

function optionsStore(storage: KeyValueStorage | null) {
  return createPersistentStore({
    key: KEY,
    storage: () => storage,
    parse: (stored) => {
      const result = parsePlayerOptions(stored);
      return result.ok ? result.options : null;
    },
    fallback: () => DEFAULTS,
  });
}

describe('createPersistentStore', () => {
  it('starts from the fallback when nothing is stored', () => {
    expect(optionsStore(memoryStorage()).getSnapshot()).toEqual({
      value: DEFAULTS,
      recovered: false,
    });
  });

  it('reads a valid stored value', () => {
    const stored = { sessionSeconds: 90, spawnIntervalSeconds: 1.5 };
    const store = optionsStore(memoryStorage({ [KEY]: JSON.stringify(stored) }));
    expect(store.getSnapshot()).toEqual({ value: stored, recovered: false });
  });

  it.each([
    ['not JSON', '{oops'],
    ['wrong shape', '"120"'],
    ['out of bounds', JSON.stringify({ sessionSeconds: 500, spawnIntervalSeconds: 3 })],
    ['off the step grid', JSON.stringify({ sessionSeconds: 125, spawnIntervalSeconds: 3 })],
    ['zero spawn interval', JSON.stringify({ sessionSeconds: 120, spawnIntervalSeconds: 0 })],
  ])('falls back to defaults and flags recovery for %s', (_label, raw) => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = optionsStore(memoryStorage({ [KEY]: raw }));
    expect(store.getSnapshot()).toEqual({ value: DEFAULTS, recovered: true });
  });

  it('persists, notifies and clears the recovery flag on save', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const storage = memoryStorage({ [KEY]: '{oops' });
    const store = optionsStore(storage);
    const listener = vi.fn();
    store.subscribe(listener);
    expect(store.getSnapshot().recovered).toBe(true);

    const next = { sessionSeconds: 180, spawnIntervalSeconds: 10 };
    expect(store.set(next)).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toEqual({ value: next, recovered: false });
    expect(JSON.parse(storage.getItem(KEY) ?? '')).toEqual(next);
    // A second store over the same storage (a reload) sees the saved value.
    expect(optionsStore(storage).getSnapshot().value).toEqual(next);
  });

  it('keeps the snapshot stable between changes', () => {
    const store = optionsStore(memoryStorage());
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it('keeps working without storage (blocked site data)', () => {
    const store = optionsStore(null);
    expect(store.set({ sessionSeconds: 60, spawnIntervalSeconds: 1 })).toBe(false);
    expect(store.getSnapshot().value).toEqual({ sessionSeconds: 60, spawnIntervalSeconds: 1 });
  });

  it('reports a storage that throws on write', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const full: KeyValueStorage = {
      ...memoryStorage(),
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(optionsStore(full).set(DEFAULTS)).toBe(false);
  });
});

describe('parseMatchSubmission', () => {
  const valid = {
    matchId: 'a1',
    playerId: 'p1',
    playerName: 'Captain Jack',
    playedAt: '2026-09-08T19:36:00.000Z',
    score: 24,
    durationMs: 120_000,
    endReason: 'time_up',
    config: { sessionSeconds: 120, spawnIntervalSeconds: 3 },
  };

  it('accepts a complete result', () => {
    expect(parseMatchSubmission(valid)).toEqual(valid);
  });

  it.each([
    ['negative score', { score: -1 }],
    ['fractional duration', { durationMs: 1.5 }],
    ['unknown end reason', { endReason: 'quit' }],
    ['bad date', { playedAt: 'yesterday' }],
    ['missing id', { matchId: '' }],
    ['config out of bounds', { config: { sessionSeconds: 30, spawnIntervalSeconds: 3 } }],
  ])('rejects %s', (_label, change) => {
    expect(parseMatchSubmission({ ...valid, ...change })).toBeNull();
  });
});
