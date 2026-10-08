import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG } from '../../config/defaults';
import { applyOptions } from '../../config/options';
import { parseMatchSubmission } from '../../api/matchSubmission';
import { buildMatchResult } from './matchResult';

const running = {
  score: 7,
  secondsLeft: 12,
  hp: 40,
  maxHp: 200,
  hpTone: 'red',
  endReason: null,
  durationMs: null,
} as const;

const identity = {
  matchId: 'c0ffee00-0000-4000-8000-000000000001',
  captain: { playerId: '0b5e7a52-3c1d-4f7e-9a2b-6c8d0e1f2a3b', name: 'Captain Jack' },
  config: applyOptions(DEFAULT_GAME_CONFIG, { sessionSeconds: 90, spawnIntervalSeconds: 1.5 }),
};

const endedAt = new Date('2026-09-08T19:36:00.000Z');

describe('buildMatchResult', () => {
  it('is null while the match runs', () => {
    expect(buildMatchResult(running, identity, endedAt)).toBeNull();
  });

  it('records the match with its identity, config and end time', () => {
    const result = buildMatchResult(
      { ...running, endReason: 'defeated', durationMs: 78_017, hp: 0 },
      identity,
      endedAt,
    );
    expect(result).toEqual({
      matchId: identity.matchId,
      playerId: identity.captain.playerId,
      playerName: 'Captain Jack',
      playedAt: '2026-09-08T19:36:00.000Z',
      score: 7,
      durationMs: 78_017,
      endReason: 'defeated',
      config: { sessionSeconds: 90, spawnIntervalSeconds: 1.5 },
    });
    // What is stored is what the Result screen reads back after a refresh.
    expect(parseMatchSubmission(JSON.parse(JSON.stringify(result)))).toEqual(result);
  });
});
