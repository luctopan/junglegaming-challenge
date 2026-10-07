import { describe, expect, it } from 'vitest';
import { ManualClock } from '../../shared/clock';
import { testControlsFromSearch } from './testControls';

describe('testControlsFromSearch', () => {
  it('reads an integer seed and the manual clock flag', () => {
    const controls = testControlsFromSearch('?test=1&seed=42&clock=manual');
    expect(controls.seed).toBe(42);
    expect(controls.manualClock).toBeInstanceOf(ManualClock);
  });

  it('falls back to a random seed and the real clock', () => {
    expect(testControlsFromSearch('?test=1&seed=abc')).toEqual({ seed: null, manualClock: null });
    expect(testControlsFromSearch('?seed=1.5').seed).toBeNull();
  });
});
