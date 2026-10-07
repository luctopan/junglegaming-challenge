import type { PlayerInput } from '../core';
import { IDLE_INPUT } from '../core';
import type { HeldAction } from './keymap';
import { HELD_ACTIONS } from './keymap';

/**
 * Held actions of every input source (a key, a touch pointer). Pure: the DOM
 * sources translate events into `press`/`release`, the simulation reads
 * `sample()` once per step.
 *
 * - Several sources may hold one action (W and ↑, two fingers): it stays held
 *   until the last one lets go.
 * - A press is latched until the next sample, so a tap shorter than one step
 *   still acts once.
 * - `clear()` (pause, blur, hidden tab, cancelled touch) forgets everything:
 *   nothing held before can act again until it is pressed again.
 */
export class InputState {
  readonly #holders = new Map<HeldAction, Set<string>>(
    HELD_ACTIONS.map((action) => [action, new Set<string>()]),
  );
  readonly #latched = new Set<HeldAction>();

  press(action: HeldAction, source: string): void {
    this.#holdersOf(action).add(source);
    this.#latched.add(action);
  }

  release(action: HeldAction, source: string): void {
    this.#holdersOf(action).delete(source);
  }

  /** Releases whatever `source` holds (a key or a finger lifted). */
  releaseSource(source: string): void {
    for (const holders of this.#holders.values()) holders.delete(source);
  }

  clear(): void {
    for (const holders of this.#holders.values()) holders.clear();
    this.#latched.clear();
  }

  isHeld(action: HeldAction): boolean {
    return this.#holdersOf(action).size > 0;
  }

  /** Nothing held and nothing latched. */
  get idle(): boolean {
    return this.#latched.size === 0 && HELD_ACTIONS.every((action) => !this.isHeld(action));
  }

  /** Commands for the next simulation step; consumes the latched taps. */
  sample(): PlayerInput {
    if (this.idle) return IDLE_INPUT;
    const on = (action: HeldAction): boolean => this.isHeld(action) || this.#latched.has(action);
    const left = on('turnLeft');
    const right = on('turnRight');
    const input: PlayerInput = {
      forward: on('forward'),
      // Both turn keys cancel out, like a rudder pulled both ways.
      turn: left === right ? 0 : left ? -1 : 1,
      fireFront: on('fireFront'),
      fireLeft: on('fireLeft'),
      fireRight: on('fireRight'),
    };
    this.#latched.clear();
    return input;
  }

  #holdersOf(action: HeldAction): Set<string> {
    const holders = this.#holders.get(action);
    // Every action gets its set in the field initialiser.
    if (holders === undefined) throw new Error(`Unknown input action: ${action}`);
    return holders;
  }
}
