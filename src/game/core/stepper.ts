import type { Clock } from '../../shared/clock';
import { MS_PER_SECOND } from '../../shared/math/constants';

export interface FixedStepperOptions {
  readonly clock: Clock;
  readonly stepSeconds: number;
  readonly maxFrameSeconds: number;
  readonly maxStepsPerFrame: number;
  /** Runs one simulation step of exactly `stepSeconds`. */
  readonly onStep: () => void;
}

export interface TickResult {
  readonly steps: number;
  /** Leftover fraction of a step, in [0, 1), for render interpolation. */
  readonly alpha: number;
}

export interface FixedStepper {
  /** Consumes the real time elapsed since the previous tick in fixed steps. */
  tick(): TickResult;
  /** Forgets the time since the last tick (start, resume after pause). */
  resetBaseline(): void;
}

/**
 * Below this many ms the accumulator counts as a whole step: frame timestamps
 * like i × 1000/144 must yield exactly the same step count as exact arithmetic,
 * or simulations at different frame rates would diverge by one step.
 */
const ACCUMULATOR_TOLERANCE_MS = 1e-6;

/**
 * Fixed-timestep accumulator: rules always advance in identical steps, so the
 * outcome does not depend on the display frame rate.
 */
export function createFixedStepper(options: FixedStepperOptions): FixedStepper {
  const stepMs = options.stepSeconds * MS_PER_SECOND;
  const maxFrameMs = options.maxFrameSeconds * MS_PER_SECOND;
  let last: number | null = null;
  let accumulator = 0;

  return {
    tick(): TickResult {
      const now = options.clock.now();
      const frameMs = last === null ? 0 : Math.min(Math.max(0, now - last), maxFrameMs);
      last = now;
      accumulator += frameMs;
      let steps = 0;
      while (accumulator + ACCUMULATOR_TOLERANCE_MS >= stepMs) {
        if (steps === options.maxStepsPerFrame) {
          // Too far behind: drop the backlog (slow motion) instead of a spiral of death.
          accumulator = 0;
          break;
        }
        options.onStep();
        accumulator = Math.max(0, accumulator - stepMs);
        steps += 1;
      }
      return { steps, alpha: accumulator / stepMs };
    },
    resetBaseline(): void {
      last = null;
    },
  };
}
