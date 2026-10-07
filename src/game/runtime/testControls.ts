import { ManualClock } from '../../shared/clock';

/**
 * Seed and clock used by the next game sessions, set through the test hook
 * (`?test=1`). Outside test mode `testControls()` is null and sessions use
 * the real clock and a random seed. Nothing here can change game rules or
 * state: tests still drive the match with real keyboard/touch input.
 */
export interface TestControls {
  /** Seed of every following match; null = random. */
  seed: number | null;
  /** Simulation time advances only through `advance(ms)`; null = real clock. */
  manualClock: ManualClock | null;
}

let controls: TestControls | null = null;

export const testControls = (): TestControls | null => controls;

export function enableTestControls(initial: Partial<TestControls> = {}): TestControls {
  controls = { seed: initial.seed ?? null, manualClock: initial.manualClock ?? null };
  return controls;
}

/** Reads `seed=<int>` and `clock=manual` from the page URL. */
export function testControlsFromSearch(search: string): Partial<TestControls> {
  const params = new URLSearchParams(search);
  const seedParam = params.get('seed');
  const seed = seedParam === null ? Number.NaN : Number(seedParam);
  return {
    seed: Number.isInteger(seed) ? seed : null,
    manualClock: params.get('clock') === 'manual' ? new ManualClock() : null,
  };
}
