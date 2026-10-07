import { describe, expect, it } from 'vitest';
import { ManualClock } from '../../shared/clock';
import { createFixedStepper } from './stepper';

function setup(maxStepsPerFrame = 8) {
  const clock = new ManualClock(1000);
  let steps = 0;
  const stepper = createFixedStepper({
    clock,
    stepSeconds: 1 / 60,
    maxFrameSeconds: 0.25,
    maxStepsPerFrame,
    onStep: () => {
      steps += 1;
    },
  });
  return { clock, stepper, total: () => steps };
}

describe('fixed stepper', () => {
  it('takes no step on the first tick (no baseline yet)', () => {
    const { stepper } = setup();
    expect(stepper.tick()).toEqual({ steps: 0, alpha: 0 });
  });

  it.each([
    [60, 1],
    [30, 2],
  ])('runs whole steps at %i Hz (%i per frame)', (hz, perFrame) => {
    const { clock, stepper } = setup();
    stepper.tick();
    for (let i = 0; i < hz; i++) {
      clock.advance(1000 / hz);
      expect(stepper.tick().steps).toBe(perFrame);
    }
  });

  it('accumulates partial frames at 144 Hz and exposes the interpolation alpha', () => {
    const { clock, stepper, total } = setup();
    stepper.tick();
    const first = (clock.advance(1000 / 144), stepper.tick());
    expect(first.steps).toBe(0);
    expect(first.alpha).toBeCloseTo(60 / 144);
    for (let i = 1; i < 144; i++) {
      clock.set(1000 + ((i + 1) * 1000) / 144);
      stepper.tick();
    }
    expect(total()).toBe(60);
  });

  it('clamps long frames and drops the backlog beyond the per-frame cap', () => {
    const { clock, stepper, total } = setup();
    stepper.tick();
    clock.advance(5000);
    const result = stepper.tick();
    expect(result.steps).toBe(8);
    expect(result.alpha).toBe(0);
    clock.advance(1000 / 60);
    expect(stepper.tick().steps).toBe(1);
    expect(total()).toBe(9);
  });

  it('resetBaseline ignores the gap (resume after pause)', () => {
    const { clock, stepper, total } = setup();
    stepper.tick();
    clock.advance(10);
    stepper.resetBaseline();
    clock.advance(10000);
    expect(stepper.tick().steps).toBe(0);
    clock.advance(1000 / 60);
    expect(stepper.tick().steps).toBe(1);
    expect(total()).toBe(1);
  });

  it('ignores a clock that goes backwards', () => {
    const { clock, stepper } = setup();
    stepper.tick();
    clock.set(500);
    expect(stepper.tick().steps).toBe(0);
  });
});
