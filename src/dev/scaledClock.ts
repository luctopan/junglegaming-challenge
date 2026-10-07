import type { Clock } from '../shared/clock';

/**
 * Clock running at `speed` × real time (0 = paused). Feeding it to the session
 * speeds up or freezes simulation, effects and water alike, because they all
 * read the same clock.
 */
export class ScaledClock implements Clock {
  #virtualBase: number;
  #realBase: number;
  #speed: number;

  constructor(
    private readonly base: Clock,
    speed = 1,
  ) {
    this.#realBase = base.now();
    this.#virtualBase = this.#realBase;
    this.#speed = speed;
  }

  now(): number {
    return this.#virtualBase + (this.base.now() - this.#realBase) * this.#speed;
  }

  get speed(): number {
    return this.#speed;
  }

  setSpeed(speed: number): void {
    // Rebase so time stays continuous across the change.
    this.#virtualBase = this.now();
    this.#realBase = this.base.now();
    this.#speed = Math.max(0, speed);
  }
}
