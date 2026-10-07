import { memo } from 'react';
import type { HeldAction } from '../../game/runtime';
import { CONTROL_ACTION_ATTRIBUTE } from '../../game/runtime';
import { RoundButton } from '../components/RoundButton';
import type { AtlasIconName } from '../components/uiArt';
import styles from './GameScreen.module.css';

interface Control {
  readonly action: HeldAction;
  readonly label: string;
  readonly icon: AtlasIconName;
}

const STEERING: readonly Control[] = [
  { action: 'turnLeft', label: 'Turn left', icon: 'turn_left' },
  { action: 'forward', label: 'Sail forward', icon: 'forward' },
  { action: 'turnRight', label: 'Turn right', icon: 'turn_right' },
];

const CANNONS: readonly Control[] = [
  { action: 'fireLeft', label: 'Fire left broadside', icon: 'fire_left' },
  { action: 'fireFront', label: 'Fire front cannon', icon: 'fire_front' },
  { action: 'fireRight', label: 'Fire right broadside', icon: 'fire_right' },
];

function ControlButton({ action, label, icon }: Control) {
  const attributes = { [CONTROL_ACTION_ATTRIBUTE]: action };
  return (
    // Hold-to-act through pointer events (runtime touch source). Keyboard players
    // have the keys, so the buttons stay out of the tab order.
    <RoundButton
      label={label}
      icon={{ atlas: icon }}
      size="large"
      className={styles.control}
      tabIndex={-1}
      {...attributes}
    />
  );
}

/**
 * On-screen controls laid out as in the mockup: steering bottom-left,
 * cannons bottom-right, the middle button raised. Shown on touch devices
 * (CSS); they hold no state: the runtime listens to their pointer events
 * (multi-touch, pointer capture) by delegation.
 */
export const TouchControls = memo(function TouchControls() {
  return (
    <div className={styles.touchControls}>
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
    </div>
  );
});
