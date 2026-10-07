import { describe, expect, it } from 'vitest';
import { tickerShouldRun } from './renderPolicy';

describe('tickerShouldRun', () => {
  it('renders continuously on the real clock while running or ended', () => {
    expect(tickerShouldRun(false, 'running')).toBe(true);
    expect(tickerShouldRun(false, 'ended')).toBe(true);
  });

  it('stops while paused: no frames until resume', () => {
    expect(tickerShouldRun(false, 'paused')).toBe(false);
  });

  it('never runs under the manual clock (frames are rendered on demand)', () => {
    expect(tickerShouldRun(true, 'running')).toBe(false);
    expect(tickerShouldRun(true, 'ended')).toBe(false);
  });
});
