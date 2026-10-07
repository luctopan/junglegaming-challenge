import type { EdgeCommand, HeldAction, KeyBinding } from '../../game/runtime/controls';

export type ControlAction = HeldAction | EdgeCommand;

/** Help rows in display order, with the touch control that does the same. */
export const CONTROL_ROWS: readonly {
  readonly action: ControlAction;
  readonly label: string;
  readonly touch: string;
}[] = [
  { action: 'forward', label: 'Sail forward', touch: 'Up arrow, bottom left' },
  { action: 'turnLeft', label: 'Turn left', touch: 'Left arrow, bottom left' },
  { action: 'turnRight', label: 'Turn right', touch: 'Right arrow, bottom left' },
  { action: 'fireFront', label: 'Fire front cannon', touch: 'Middle button, bottom right' },
  { action: 'fireLeft', label: 'Fire left broadside', touch: 'Left button, bottom right' },
  { action: 'fireRight', label: 'Fire right broadside', touch: 'Right button, bottom right' },
  { action: 'pause', label: 'Pause', touch: 'Pause button, top right' },
];

const KEY_NAMES: Readonly<Record<string, string>> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Space: 'Space',
  Escape: 'Esc',
};

/** Printable name of a `KeyboardEvent.code` (`KeyW` → `W`). */
export const keyName = (code: string): string => KEY_NAMES[code] ?? code.replace(/^Key|^Digit/, '');

const actionOf = (binding: KeyBinding): ControlAction =>
  binding.kind === 'held' ? binding.action : binding.command;

/** Keys of every action, in binding order (primary key first), from the game's own key map. */
export function keysByAction(
  bindings: Readonly<Record<string, KeyBinding>>,
): Readonly<Record<ControlAction, readonly string[]>> {
  const keys: Record<ControlAction, string[]> = {
    forward: [],
    turnLeft: [],
    turnRight: [],
    fireFront: [],
    fireLeft: [],
    fireRight: [],
    pause: [],
  };
  for (const [code, binding] of Object.entries(bindings))
    keys[actionOf(binding)].push(keyName(code));
  return keys;
}
