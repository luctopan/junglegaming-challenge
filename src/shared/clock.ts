/** Monotonic time source in milliseconds; injected so simulation timing is testable. */
export interface Clock {
  now(): number;
}

/** Clock driven explicitly by tests and by the test-mode hook. */
export class ManualClock implements Clock {
  #now: number;

  constructor(startMs = 0) {
    this.#now = startMs;
  }

  now(): number {
    return this.#now;
  }

  advance(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) {
      throw new RangeError(`ManualClock.advance: expected a finite ms >= 0, got ${ms}`);
    }
    this.#now += ms;
  }

  set(ms: number): void {
    this.#now = ms;
  }
}
