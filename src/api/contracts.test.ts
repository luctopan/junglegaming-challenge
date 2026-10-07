import { describe, expect, it } from 'vitest';
import { configKeyOf, pageCount, parseConfigKey } from './contracts';

describe('config keys', () => {
  it('round-trips whole and fractional values', () => {
    for (const config of [
      { sessionSeconds: 120, spawnIntervalSeconds: 3 },
      { sessionSeconds: 60, spawnIntervalSeconds: 1.5 },
    ]) {
      expect(parseConfigKey(configKeyOf(config))).toEqual(config);
    }
    expect(configKeyOf({ sessionSeconds: 90, spawnIntervalSeconds: 2.5 })).toBe('90s-2.5s');
  });

  it('rejects anything that is not a config key', () => {
    for (const key of ['', '120-3', '120s-3', 'abc', '120s-3s-1s', '-1s-3s']) {
      expect(parseConfigKey(key), key).toBeNull();
    }
  });
});

describe('pageCount', () => {
  it('is at least one page', () => {
    expect(pageCount(0, 5)).toBe(1);
    expect(pageCount(5, 5)).toBe(1);
    expect(pageCount(6, 5)).toBe(2);
    expect(pageCount(13, 5)).toBe(3);
  });
});
