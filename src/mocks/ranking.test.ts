import { describe, expect, it } from 'vitest';
import type { MatchRecord } from '../api/contracts';
import { createMockDb } from './db';
import { FIXTURE_RECORDS } from './fixtures';
import { historyOf, paginate, rankedConfigsOf, rankingOf } from './ranking';
import { memoryStorage } from '../platform/storage';

const record = (overrides: Partial<MatchRecord>): MatchRecord => ({
  matchId: 'm',
  playerId: 'p',
  playerName: 'Captain',
  playedAt: '2026-09-08T10:00:00.000Z',
  score: 10,
  durationMs: 60_000,
  endReason: 'time_up',
  config: { sessionSeconds: 120, spawnIntervalSeconds: 3 },
  configKey: '120s-3s',
  recordedAt: '2026-09-08T10:00:00.000Z',
  ...overrides,
});

describe('mock ranking', () => {
  it('orders by score, then shorter duration, earlier date and matchId', () => {
    const records = [
      record({ matchId: 'e', score: 5 }),
      record({ matchId: 'd', score: 10, playedAt: '2026-09-08T11:00:00.000Z' }),
      record({ matchId: 'c', score: 10 }),
      record({ matchId: 'b', score: 10 }),
      record({ matchId: 'a', score: 10, durationMs: 50_000 }),
      record({ matchId: 'z', score: 99, configKey: '60s-1s' }),
    ];
    const ranking = rankingOf(records, '120s-3s');
    expect(ranking.map((entry) => entry.matchId)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(ranking.map((entry) => entry.rank)).toEqual([1, 2, 3, 4, 5]);
    // Input order never changes the result.
    expect(rankingOf([...records].reverse(), '120s-3s')).toEqual(ranking);
  });

  it('keeps one entry per match, so a captain may appear several times', () => {
    const ranking = rankingOf(
      [record({ matchId: 'x', score: 3 }), record({ matchId: 'y', score: 4 })],
      '120s-3s',
    );
    expect(ranking.map((entry) => entry.playerId)).toEqual(['p', 'p']);
  });

  it('paginates with a clamped page and at least one page', () => {
    const items = Array.from({ length: 13 }, (_, i) => i);
    expect(paginate(items, 3, 5, 7)).toEqual({
      items: [10, 11, 12],
      page: 3,
      pageSize: 5,
      totalItems: 13,
      totalPages: 3,
      revision: 7,
    });
    expect(paginate(items, 99, 5, 1).page).toBe(3);
    expect(paginate([], 1, 5, 1)).toMatchObject({ items: [], totalPages: 1 });
  });

  it('lists history newest first and ranked configs by length', () => {
    const history = historyOf(
      [
        record({ matchId: 'old', playedAt: '2026-01-01T00:00:00.000Z' }),
        record({ matchId: 'new', playedAt: '2026-02-01T00:00:00.000Z' }),
        record({ matchId: 'other', playerId: 'q' }),
      ],
      'p',
    );
    expect(history.map((r) => r.matchId)).toEqual(['new', 'old']);
    expect(rankedConfigsOf(FIXTURE_RECORDS).map((c) => [c.configKey, c.records])).toEqual([
      ['60s-1s', 4],
      ['120s-3s', 13],
      ['180s-5s', 6],
    ]);
  });

  it('fixtures never use a UUID player id and have fixed dates', () => {
    for (const fixture of FIXTURE_RECORDS) {
      expect(fixture.playerId).toMatch(/^fixture-/);
      expect(fixture.playedAt < '2026-09-09').toBe(true);
    }
  });
});

describe('mock db', () => {
  const match = {
    matchId: 'f8d0c3b2-1a2b-4c3d-8e4f-5a6b7c8d9e0f',
    playerId: '0b5e7a52-3c1d-4f7e-9a2b-6c8d0e1f2a3b',
    playerName: 'Test',
    playedAt: '2026-09-08T19:36:00.000Z',
    score: 24,
    durationMs: 120_000,
    endReason: 'time_up' as const,
    config: { sessionSeconds: 120, spawnIntervalSeconds: 3 },
  };
  const now = new Date('2026-09-08T19:36:01.000Z');

  it('stores a match once: a resend is existing, a different payload a conflict', () => {
    const storage = memoryStorage();
    const db = createMockDb(() => storage);
    expect(db.put(match, now).kind).toBe('created');
    expect(db.put(match, now).kind).toBe('existing');
    expect(db.put({ ...match, score: 25 }, now).kind).toBe('conflict');
    expect(db.records()).toHaveLength(1);
    // Persisted: a new instance (page refresh) sees it.
    expect(createMockDb(() => storage).records()).toHaveLength(1);
  });

  it('keeps the revision monotonic across resets', () => {
    const storage = memoryStorage();
    const db = createMockDb(() => storage);
    const start = db.revision();
    db.put(match, now);
    const afterWrite = db.revision();
    db.reset();
    expect(db.records()).toEqual([]);
    expect(afterWrite).toBeGreaterThan(start);
    expect(db.revision()).toBeGreaterThan(afterWrite);
  });
});
