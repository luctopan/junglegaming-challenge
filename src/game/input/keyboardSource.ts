import type { DisposableScope } from '../../platform/disposableScope';
import type { InputState } from './inputState';
import type { EdgeCommand } from './keymap';
import { interpretKeyDown, keySource } from './keymap';

export interface KeyboardSourceOptions {
  /** Listens on the window: game keys work wherever the focus is. */
  readonly target: Window;
  /** Read per event: a restart swaps the state for a fresh one. */
  readonly state: () => InputState;
  /** True only while the match is running (keys are captured only then). */
  readonly isActive: () => boolean;
  readonly onCommand: (command: EdgeCommand) => void;
}

const isEditable = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * Keyboard → `InputState`. Game keys are prevented (no page scroll on Space or
 * arrows, no button activation) only while gameplay is active; a key whose
 * keydown was captured also has its keyup prevented, so releasing Space after
 * the pause dialog opened cannot click the focused Resume button.
 */
export function attachKeyboard(scope: DisposableScope, options: KeyboardSourceOptions): void {
  const { target, state, isActive, onCommand } = options;
  const captured = new Set<string>();

  scope.listen(target, 'keydown', (event) => {
    // Already handled by the UI (e.g. Escape closing the pause dialog), or typing in a field.
    if (event.defaultPrevented || isEditable(event.target)) return;
    const effect = interpretKeyDown(event, isActive());
    if (effect.kind === 'ignore') return;
    event.preventDefault();
    captured.add(event.code);
    switch (effect.kind) {
      case 'swallow':
        return;
      case 'press':
        state().press(effect.action, keySource(event.code));
        return;
      case 'command':
        onCommand(effect.command);
        return;
      default:
        effect satisfies never;
    }
  });

  scope.listen(target, 'keyup', (event) => {
    // Releases always apply, even outside gameplay: a key never stays stuck.
    state().releaseSource(keySource(event.code));
    if (captured.delete(event.code)) event.preventDefault();
  });
}
