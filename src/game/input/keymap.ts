/**
 * Keyboard bindings by `KeyboardEvent.code` (physical key position), so the
 * layout (QWERTY, AZERTY, ABNT…), Caps Lock and Shift never change the
 * controls: the key under the left ring finger is always "turn left".
 */

/** Actions that act while held (re-sampled every simulation step). */
export type HeldAction =
  'forward' | 'turnLeft' | 'turnRight' | 'fireFront' | 'fireLeft' | 'fireRight';

export const HELD_ACTIONS: readonly HeldAction[] = [
  'forward',
  'turnLeft',
  'turnRight',
  'fireFront',
  'fireLeft',
  'fireRight',
];

/** One-shot commands: act once per physical press. */
export type EdgeCommand = 'pause';

export type KeyBinding =
  | { readonly kind: 'held'; readonly action: HeldAction }
  | { readonly kind: 'edge'; readonly command: EdgeCommand };

const held = (action: HeldAction): KeyBinding => ({ kind: 'held', action });

/** docs/DECISIONS.md "Keyboard". */
export const KEY_BINDINGS: Readonly<Record<string, KeyBinding>> = {
  KeyW: held('forward'),
  ArrowUp: held('forward'),
  KeyA: held('turnLeft'),
  ArrowLeft: held('turnLeft'),
  KeyD: held('turnRight'),
  ArrowRight: held('turnRight'),
  Space: held('fireFront'),
  KeyK: held('fireFront'),
  KeyQ: held('fireLeft'),
  KeyJ: held('fireLeft'),
  KeyE: held('fireRight'),
  KeyL: held('fireRight'),
  KeyP: { kind: 'edge', command: 'pause' },
  Escape: { kind: 'edge', command: 'pause' },
};

/** The fields of a `KeyboardEvent` the mapping depends on (testable without a DOM). */
export interface KeyEventLike {
  readonly code: string;
  readonly repeat: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
}

export type KeyDownEffect =
  /** Not ours: the browser handles it normally (no preventDefault). */
  | { readonly kind: 'ignore' }
  /** A game key we own, but the event must not act (auto-repeat): only prevent the default. */
  | { readonly kind: 'swallow' }
  | { readonly kind: 'press'; readonly action: HeldAction }
  | { readonly kind: 'command'; readonly command: EdgeCommand };

/**
 * What a keydown means while gameplay is `active`. Outside gameplay nothing is
 * captured, so menus, dialogs and page scrolling behave normally. Shortcuts
 * with Ctrl/Alt/Meta stay the browser's. Auto-repeat never acts: held actions
 * are already held, and after a pause a key still physically down must not
 * resume moving or firing until it is pressed again.
 */
export function interpretKeyDown(event: KeyEventLike, active: boolean): KeyDownEffect {
  if (!active || event.ctrlKey || event.altKey || event.metaKey) return { kind: 'ignore' };
  const binding = KEY_BINDINGS[event.code];
  if (binding === undefined) return { kind: 'ignore' };
  if (event.repeat) return { kind: 'swallow' };
  return binding.kind === 'held'
    ? { kind: 'press', action: binding.action }
    : { kind: 'command', command: binding.command };
}

export const keySource = (code: string): string => `key:${code}`;
export const pointerSource = (pointerId: number): string => `pointer:${pointerId}`;
