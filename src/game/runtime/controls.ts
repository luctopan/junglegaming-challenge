/**
 * The control scheme for help screens, without the game runtime: imported by
 * the menu, so it must not pull Pixi into the menu's chunk (see index.ts for
 * the full runtime API).
 */
export { HELD_ACTIONS, KEY_BINDINGS } from '../input/keymap';
export type { EdgeCommand, HeldAction, KeyBinding } from '../input/keymap';
