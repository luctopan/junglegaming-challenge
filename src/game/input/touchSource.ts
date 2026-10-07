import type { DisposableScope } from '../../platform/disposableScope';
import type { InputState } from './inputState';
import type { HeldAction } from './keymap';
import { HELD_ACTIONS, pointerSource } from './keymap';

/** On-screen controls declare their action with this attribute (event delegation). */
export const CONTROL_ACTION_ATTRIBUTE = 'data-game-action';
/** Set on a control while a pointer holds it, for the pressed look. */
export const CONTROL_PRESSED_ATTRIBUTE = 'data-pressed';

export interface TouchSourceOptions {
  /** Ancestor of every on-screen control. */
  readonly root: HTMLElement;
  readonly state: () => InputState;
  readonly isActive: () => boolean;
}

export interface TouchSource {
  /** Drops every held pointer (pause, blur): fingers still down act only after a new press. */
  releaseAll(): void;
}

const isHeldAction = (value: string | null): value is HeldAction =>
  value !== null && (HELD_ACTIONS as readonly string[]).includes(value);

/**
 * Pointer events → `InputState`, hold-to-act. Each pointer is its own source,
 * so one finger can steer while another fires. Pointer capture keeps a press
 * on its control even if the finger slides off; any end of the pointer
 * (up, cancel, lost capture) releases it.
 */
export function attachTouchControls(
  scope: DisposableScope,
  options: TouchSourceOptions,
): TouchSource {
  const { root, state, isActive } = options;
  const pressed = new Map<number, Element>();

  const release = (pointerId: number): void => {
    state().releaseSource(pointerSource(pointerId));
    pressed.get(pointerId)?.removeAttribute(CONTROL_PRESSED_ATTRIBUTE);
    pressed.delete(pointerId);
  };

  const controlOf = (target: EventTarget | null): Element | null => {
    if (!(target instanceof Element)) return null;
    const control = target.closest(`[${CONTROL_ACTION_ATTRIBUTE}]`);
    return control !== null && root.contains(control) ? control : null;
  };

  scope.listen(root, 'pointerdown', (event) => {
    if (!(event instanceof PointerEvent)) return;
    const control = controlOf(event.target);
    if (control === null) return;
    // No focus change, text selection or emulated mouse events from a control.
    event.preventDefault();
    const action = control.getAttribute(CONTROL_ACTION_ATTRIBUTE);
    if (!isActive() || !isHeldAction(action)) return;
    if (control.isConnected) control.setPointerCapture(event.pointerId);
    state().press(action, pointerSource(event.pointerId));
    control.setAttribute(CONTROL_PRESSED_ATTRIBUTE, 'true');
    pressed.set(event.pointerId, control);
  });

  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    scope.listen(root, type, (event) => {
      if (event instanceof PointerEvent) release(event.pointerId);
    });
  }

  // Long-press must not open the context menu (or a selection callout) on a control.
  scope.listen(root, 'contextmenu', (event) => {
    if (controlOf(event.target) !== null) event.preventDefault();
  });

  return {
    releaseAll() {
      for (const pointerId of [...pressed.keys()]) release(pointerId);
    },
  };
}
