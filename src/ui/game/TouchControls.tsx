import { memo } from 'react';
import type { HeldAction } from '../../game/runtime';
import { CONTROL_ACTION_ATTRIBUTE } from '../../game/runtime';
import styles from './GameScreen.module.css';

interface Control {
  readonly action: HeldAction;
  readonly label: string;
  readonly symbol: string;
}

const STEERING: readonly Control[] = [
  { action: 'turnLeft', label: 'Turn left', symbol: '↶' },
  { action: 'forward', label: 'Sail forward', symbol: '↑' },
  { action: 'turnRight', label: 'Turn right', symbol: '↷' },
];

const CANNONS: readonly Control[] = [
  { action: 'fireLeft', label: 'Fire left broadside', symbol: '⇇' },
  { action: 'fireFront', label: 'Fire front cannon', symbol: '●' },
  { action: 'fireRight', label: 'Fire right broadside', symbol: '⇉' },
];

function ControlButton({ action, label, symbol }: Control) {
  const attributes = { [CONTROL_ACTION_ATTRIBUTE]: action };
  return (
    // Hold-to-act through pointer events (runtime touch source). Keyboard players
    // have the keys, so the buttons stay out of the tab order.
    <button
      type="button"
      className={styles.control}
      aria-label={label}
      tabIndex={-1}
      {...attributes}
    >
      <span aria-hidden="true">{symbol}</span>
    </button>
  );
}

/**
 * On-screen controls laid out as in the mockup: steering bottom-left,
 * cannons bottom-right. They hold no state: the runtime listens to their
 * pointer events (multi-touch, pointer capture) by delegation.
 */
export const TouchControls = memo(function TouchControls() {
  return (
    <>
      <div className={`${styles.controlPad} ${styles.steering}`}>
        {STEERING.map((control) => (
          <ControlButton key={control.action} {...control} />
        ))}
      </div>
      <div className={`${styles.controlPad} ${styles.cannons}`}>
        {CANNONS.map((control) => (
          <ControlButton key={control.action} {...control} />
        ))}
      </div>
    </>
  );
});
