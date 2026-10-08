import { describe, expect, it } from 'vitest';
import { memoryStorage } from '../platform/storage';
import type { MatchSubmission } from './contracts';
import { createPendingQueue, PENDING_QUEUE_KEY } from './pendingQueue';

const match = (matchId: string): MatchSubmission => ({
  matchId,
  playerId: '0b5e7a52-3c1d-4f7e-9a2b-6c8d0e1f2a3b',
  playerName: 'Test',
  playedAt: '2026-09-08T19:36:00.000Z',
  score: 24,
  durationMs: 120_000,
  endReason: 'time_up',
  config: { sessionSeconds: 120, spawnIntervalSeconds: 3 },
});

describe('pending queue', () => {
  it('persists entries, deduplicated by matchId, and survives a reload', () => {
    const storage = memoryStorage();
    const queue = createPendingQueue(() => storage);
    expect(queue.add(match('a'))).toBe(true);
    queue.add(match('a'));
    queue.add(match('b'));
    expect(queue.list().map((m) => m.matchId)).toEqual(['a', 'b']);

    const reloaded = createPendingQueue(() => storage);
    expect(reloaded.list()).toEqual([match('a'), match('b')]);
    reloaded.remove('a');
    expect(createPendingQueue(() => storage).list()).toEqual([match('b')]);
  });

  it('keeps the stored payload byte-identical for resends', () => {
    const storage = memoryStorage();
    createPendingQueue(() => storage).add(match('a'));
    const raw = storage.getItem(PENDING_QUEUE_KEY);
    expect(JSON.stringify(createPendingQueue(() => storage).list())).toBe(raw);
  });

  it('drops invalid entries but keeps the valid ones', () => {
    const storage = memoryStorage({
      [PENDING_QUEUE_KEY]: JSON.stringify([{ matchId: 1 }, match('ok'), 'junk']),
    });
    expect(createPendingQueue(() => storage).list()).toEqual([match('ok')]);
    const corrupt = memoryStorage({ [PENDING_QUEUE_KEY]: '{not json' });
    expect(createPendingQueue(() => corrupt).list()).toEqual([]);
  });

  it('works in memory when storage is blocked', () => {
    const queue = createPendingQueue(() => null);
    expect(queue.add(match('a'))).toBe(false);
    expect(queue.has('a')).toBe(true);
    queue.clear();
    expect(queue.has('a')).toBe(false);
  });
});
