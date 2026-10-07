import { useEffect, useRef } from 'react';
import type { PauseReason } from '../../game/bridge/gameStore';
import styles from './GameScreen.module.css';

const MESSAGES: Readonly<Record<PauseReason, string>> = {
  manual: 'Ready when you are.',
  blur: 'Paused while the game window was in the background.',
  hidden: 'Paused while the game tab was hidden.',
};

/** Keys that close the dialog, as they opened it (by physical key, see game keymap). */
const RESUME_KEYS = new Set(['Escape', 'KeyP']);

interface PauseDialogProps {
  readonly reason: PauseReason;
  readonly onResume: () => void;
  readonly onMainMenu: () => void;
}

/**
 * Minimal pause dialog (the styled one with Options and a focus trap comes in
 * Phase 4). Resuming always takes an explicit action: the Resume button, or a
 * fresh Escape/P press. Auto-repeat of the key that paused is ignored, so
 * holding Escape cannot pause and resume in a loop.
 */
export function PauseDialog({ reason, onResume, onMainMenu }: PauseDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const resumeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    resumeRef.current?.focus();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!RESUME_KEYS.has(event.code) || event.repeat) return;
      // Marks the key as handled, so the game's keyboard source does not pause again.
      event.preventDefault();
      onResume();
    };
    dialog.addEventListener('keydown', onKeyDown);
    return () => {
      dialog.removeEventListener('keydown', onKeyDown);
    };
  }, [onResume]);

  return (
    <div className={styles.backdrop}>
      <section
        ref={dialogRef}
        className={styles.overlay}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-title"
        aria-describedby="pause-message"
      >
        <h2 id="pause-title">Paused</h2>
        <p id="pause-message">{MESSAGES[reason]}</p>
        <button ref={resumeRef} type="button" className={styles.button} onClick={onResume}>
          Resume
        </button>
        <button type="button" className={styles.button} onClick={onMainMenu}>
          Main menu
        </button>
      </section>
    </div>
  );
}
