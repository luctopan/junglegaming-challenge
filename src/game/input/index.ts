/**
 * Player input: keyboard and on-screen touch controls translated into the
 * abstract `PlayerInput` the simulation consumes. Mapping and held-state rules
 * are pure (`keymap`, `InputState`); the DOM sources are thin adapters.
 */
export { InputState } from './inputState';
export { HELD_ACTIONS, KEY_BINDINGS, interpretKeyDown } from './keymap';
export type { EdgeCommand, HeldAction, KeyBinding, KeyDownEffect, KeyEventLike } from './keymap';
export { attachKeyboard } from './keyboardSource';
export type { KeyboardSourceOptions } from './keyboardSource';
export {
  attachTouchControls,
  CONTROL_ACTION_ATTRIBUTE,
  CONTROL_PRESSED_ATTRIBUTE,
} from './touchSource';
export type { TouchSource, TouchSourceOptions } from './touchSource';
