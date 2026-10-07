import type { GameConfig } from '../../config/gameConfig';
import type { Clock } from '../../shared/clock';
import type { PauseReason } from '../bridge/gameStore';
import type { DomainEvent, FixedStepper, World } from '../core';
import { createFixedStepper, createMatch, step } from '../core';
import { InputState } from '../input';
import type { InputSource } from './inputSource';

export type PlayState = 'running' | 'paused' | 'ended';

export interface MatchDriverOptions {
  readonly config: GameConfig;
  readonly seed: number;
  readonly clock: Clock;
  /** Replaces the player's keyboard/touch input (scripted bots in the dev sandbox). */
  readonly scripted?: InputSource | undefined;
}

/**
 * One match: world, fixed-step loop, the player's held inputs and the pause
 * state. No DOM and no Pixi, so the pause and input rules are unit-tested
 * with a manual clock. A restart builds a new driver: nothing (time, input,
 * pause, pending events) carries over from the previous match.
 *
 * Pause rules: while paused the stepper is not ticked, so the timer,
 * cooldowns, AI and spawns stand still; pausing and resuming both clear every
 * held input; resuming resets the stepper baseline so the paused wall-clock
 * time never enters the accumulator.
 */
export class MatchDriver {
  readonly world: World;
  readonly input = new InputState();
  readonly #stepper: FixedStepper;
  readonly #events: DomainEvent[] = [];
  #pauseReason: PauseReason | null = null;
  #alpha = 0;

  constructor(options: MatchDriverOptions) {
    const { config, seed, clock, scripted } = options;
    this.world = createMatch(config, seed);
    const source: InputSource = scripted ?? { sample: () => this.input.sample() };
    this.#stepper = createFixedStepper({
      clock,
      stepSeconds: config.simulation.stepSeconds,
      maxFrameSeconds: config.simulation.maxFrameSeconds,
      maxStepsPerFrame: config.simulation.maxStepsPerFrame,
      onStep: () => {
        this.#events.push(...step(this.world, source.sample(this.world)));
      },
    });
  }

  get state(): PlayState {
    if (this.world.phase === 'ended') return 'ended';
    return this.#pauseReason === null ? 'running' : 'paused';
  }

  get pauseReason(): PauseReason | null {
    return this.state === 'paused' ? this.#pauseReason : null;
  }

  /** Starts counting time from now (when the arena first shows). */
  start(): void {
    this.#stepper.resetBaseline();
  }

  /**
   * Runs the steps due since the last tick. Returns the interpolation alpha
   * for rendering (frozen while paused or ended).
   */
  tick(): number {
    if (this.state !== 'running') return this.#alpha;
    this.#alpha = this.#stepper.tick().alpha;
    return this.#alpha;
  }

  /** Domain events of the steps run since the last call. */
  drainEvents(): DomainEvent[] {
    return this.#events.splice(0);
  }

  /** Returns false when there was nothing to pause (already paused, ended). */
  pause(reason: PauseReason): boolean {
    if (this.state !== 'running') return false;
    this.#pauseReason = reason;
    this.input.clear();
    return true;
  }

  /** Only an explicit player action calls this; returns false when not paused. */
  resume(): boolean {
    if (this.state !== 'paused') return false;
    this.#pauseReason = null;
    this.input.clear();
    this.#stepper.resetBaseline();
    return true;
  }
}
