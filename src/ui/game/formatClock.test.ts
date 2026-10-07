import { describe, expect, it } from 'vitest';
import { formatClock, formatDuration, spokenDuration } from './formatClock';

describe('formatClock', () => {
  it('shows mm:ss, rounding up partial seconds', () => {
    expect(formatClock(120)).toBe('02:00');
    expect(formatClock(119.2)).toBe('02:00');
    expect(formatClock(102)).toBe('01:42');
    expect(formatClock(0.01)).toBe('00:01');
    expect(formatClock(-3)).toBe('00:00');
  });
});

describe('formatDuration', () => {
  it('shows played time, rounding down', () => {
    expect(formatDuration(120_000)).toBe('02:00');
    expect(formatDuration(119_983)).toBe('01:59');
    expect(formatDuration(78_000)).toBe('01:18');
    expect(formatDuration(0)).toBe('00:00');
  });
});

describe('spokenDuration', () => {
  it('spells durations out', () => {
    expect(spokenDuration(120)).toBe('2 minutes');
    expect(spokenDuration(61)).toBe('1 minute 1 second');
    expect(spokenDuration(42)).toBe('42 seconds');
    expect(spokenDuration(0)).toBe('0 seconds');
  });
});
