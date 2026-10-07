import { useId } from 'react';
import { KEY_BINDINGS } from '../../game/runtime/controls';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { COARSE_POINTER, useMediaQuery } from '../hooks/useMediaQuery';
import screen from '../screens/screen.module.css';
import { CONTROL_ROWS, keysByAction } from './controlsHelp';
import styles from './ControlsDialog.module.css';

const KEYS = keysByAction(KEY_BINDINGS);

/** Always-visible one-line summary in the menu panel (touch wording on touch devices). */
export function ControlsSummary() {
  const touch = useMediaQuery(COARSE_POINTER);
  return (
    <p className={styles.summary}>
      {touch ? (
        <>
          <span className={styles.label}>Touch:</span> steer with the buttons on the left · fire
          with the buttons on the right · pause top right
        </>
      ) : (
        <>
          <span className={styles.label}>Keys:</span> sail <Keys keys={KEYS.forward} /> · turn{' '}
          <Keys keys={[KEYS.turnLeft[0], KEYS.turnRight[0]]} /> · fire{' '}
          <Keys keys={KEYS.fireFront} /> · broadsides{' '}
          <Keys keys={[KEYS.fireLeft[0], KEYS.fireRight[0]]} /> · pause <Keys keys={KEYS.pause} />
        </>
      )}
    </p>
  );
}

function Keys({ keys }: { readonly keys: readonly (string | undefined)[] }) {
  const shown = keys.filter((key): key is string => key !== undefined);
  return (
    <>
      {shown.map((key, index) => (
        <span key={key}>
          {index > 0 ? '/' : null}
          <kbd className={styles.key}>{key}</kbd>
        </span>
      ))}
    </>
  );
}

/** Full keyboard and touch reference. */
export function ControlsDialog({ onClose }: { readonly onClose: () => void }) {
  const id = useId();
  return (
    <Dialog labelledBy={`${id}-title`} onEscape={onClose} size="wide">
      <h2 id={`${id}-title`} className={screen.heading}>
        Controls
      </h2>
      <p className={screen.text}>
        Sail and fire at the same time. Every cannon reloads on its own.
      </p>
      <table className={styles.table}>
        <caption className="visually-hidden">Keyboard and touch controls</caption>
        <thead>
          <tr>
            <th scope="col">Action</th>
            <th scope="col">Keyboard</th>
            <th scope="col">Touch</th>
          </tr>
        </thead>
        <tbody>
          {CONTROL_ROWS.map((row) => (
            <tr key={row.action}>
              <th scope="row">{row.label}</th>
              <td>
                <Keys keys={KEYS[row.action]} />
              </td>
              <td>{row.touch}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button onClick={onClose}>Close</Button>
    </Dialog>
  );
}
