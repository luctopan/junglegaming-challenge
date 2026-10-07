import { describe, expect, it } from 'vitest';
import { ManualClock } from '../../shared/clock';
import { createMatch } from './createMatch';
import type { DomainEvent } from './events';
import { step } from './step';
import { createFixedStepper } from './stepper';
import { configWith, ofType } from './testing/fixtures';
import { naiveBotInput } from './testing/naiveBot';
import { scriptedInputAt } from './testing/scriptedInput';
import type { PlayerInput, World } from './types';

interface Outcome {
  readonly world: World;
  readonly events: DomainEvent[];
}

/** The player cannot die, so every run simulates the full duration. */
const sturdy = configWith((c) => {
  c.ships.player.maxHp = 1e9;
});

/** Drives a match through the real fixed stepper with frames at `hz`. */
function runAtFrameRate(hz: number, seconds: number, seed: number): Outcome {
  const world = createMatch(sturdy, seed);
  const clock = new ManualClock(0);
  const events: DomainEvent[] = [];
  let held: PlayerInput = scriptedInputAt(0);
  const stepper = createFixedStepper({
    clock,
    ...world.cfg.simulation,
    onStep: () => events.push(...step(world, held)),
  });
  stepper.tick();
  for (let frame = 1; frame <= seconds * hz; frame++) {
    const now = frame / hz;
    held = scriptedInputAt(now);
    clock.set((frame * 1000) / hz);
    stepper.tick();
  }
  return { world, events };
}

describe('frame-rate independence', () => {
  it('30, 60 and 144 Hz frame sequences produce the same match', () => {
    const seconds = 20;
    const at60 = runAtFrameRate(60, seconds, 7);
    const at30 = runAtFrameRate(30, seconds, 7);
    const at144 = runAtFrameRate(144, seconds, 7);

    expect(at60.world.stepCount).toBe(seconds * 60);
    // The run is eventful enough to be meaningful.
    expect(ofType(at60.events, 'shotFired').length).toBeGreaterThan(10);
    expect(ofType(at60.events, 'enemySpawned').length).toBeGreaterThan(3);

    expect(at30.events).toEqual(at60.events);
    expect(at144.events).toEqual(at60.events);
    expect(at30.world).toEqual(at60.world);
    expect(at144.world).toEqual(at60.world);
  });
});

/** Full headless match driven by the scripted bot, one step at a time. */
function playMatch(seed: number): Outcome {
  const cfg = configWith((c) => {
    c.match.sessionSeconds = 180;
  });
  const world = createMatch(cfg, seed);
  const events: DomainEvent[] = [];
  const maxSteps = Math.round(180 / cfg.simulation.stepSeconds);
  for (let i = 0; i < maxSteps && world.phase === 'running'; i++) {
    events.push(...step(world, naiveBotInput(world)));
  }
  return { world, events };
}

describe('headless 180 s match', () => {
  it.each([1, 42, 1337])('seed %i: same seed → identical event log and final state', (seed) => {
    const first = playMatch(seed);
    const second = playMatch(seed);
    expect(first.world.phase).toBe('ended');
    expect(ofType(first.events, 'matchEnded')).toHaveLength(1);
    expect(ofType(first.events, 'enemySpawned').length).toBeGreaterThan(2);
    expect(second.events).toEqual(first.events);
    expect(second.world).toEqual(first.world);
  });

  it('different seeds produce different matches', () => {
    expect(playMatch(1).events).not.toEqual(playMatch(2).events);
  });
});
