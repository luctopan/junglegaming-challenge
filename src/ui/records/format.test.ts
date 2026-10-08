import { describe, expect, it } from 'vitest';
import { describeConfig, formatPlayedAt, rankLabel } from './format';

describe('records formatting', () => {
  it('formats the played date as in the mockup', () => {
    expect(formatPlayedAt('2026-09-08T21:42:10.000Z', 'UTC')).toEqual({
      date: '08 SEP',
      time: '21:42',
      spoken: 'September 8, 21:42',
    });
    expect(formatPlayedAt('2026-09-08T00:05:00.000Z', 'UTC').time).toBe('00:05');
    // The player's own time zone decides the day.
    expect(formatPlayedAt('2026-09-08T01:00:00.000Z', 'America/Sao_Paulo').date).toBe('07 SEP');
  });

  it('describes a config and pads ranks', () => {
    expect(describeConfig({ sessionSeconds: 120, spawnIntervalSeconds: 3 })).toBe(
      '120 second battles · 3 second spawn interval',
    );
    expect(describeConfig({ sessionSeconds: 60, spawnIntervalSeconds: 1.5 })).toContain(
      '1.5 second',
    );
    expect([rankLabel(1), rankLabel(12), rankLabel(103)]).toEqual(['01', '12', '103']);
  });
});
