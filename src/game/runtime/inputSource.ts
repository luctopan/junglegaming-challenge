import type { PlayerInput, World } from '../core';
import { IDLE_INPUT } from '../core';

/**
 * Where the player's commands come from each simulation step: keyboard/touch
 * in the game (Phase 3), a scripted bot in the dev sandbox. Sources only read
 * the world.
 */
export interface InputSource {
  sample(world: World): PlayerInput;
}

export const IDLE_INPUT_SOURCE: InputSource = { sample: () => IDLE_INPUT };
