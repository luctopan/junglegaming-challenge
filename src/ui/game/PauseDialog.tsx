import type { KeyboardEvent } from 'react';
import { useRef, useState } from 'react';
import type { PauseReason } from '../../game/bridge/gameStore';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { OptionsPanel } from '../screens/options/OptionsPanel';
import screen from '../screens/screen.module.css';

const MESSAGES: Readonly<Record<PauseReason, string>> = {
  manual: 'Ready when you are.',
  blur: 'Paused while the game window was in the background.',
  hidden: 'Paused while the game tab was hidden.',
  portrait: 'Paused while the screen was in portrait. Play in landscape.',
};

/** Keys that close the pause menu, as they opened it (by physical key, see the game keymap). */
const RESUME_KEYS = new Set(['Escape', 'KeyP']);

interface PauseDialogProps {
  readonly reason: PauseReason;
  readonly onResume: () => void;
  readonly onMainMenu: () => void;
}

type View = 'menu' | 'options';

/**
 * Pause menu (assets/sample_pause.png): Resume, Options, Main menu. Resuming
 * always takes an explicit action: the Resume button, or a fresh Escape/P.
 * Auto-repeat of the key that paused is ignored, so holding Escape cannot
 * pause and resume in a loop. Options open in place; changes are saved but
 * apply to the next battle only (the running match keeps its config snapshot).
 */
export function PauseDialog({ reason, onResume, onMainMenu }: PauseDialogProps) {
  const [view, setView] = useState<View>('menu');
  const [cameBack, setCameBack] = useState(false);
  const resumeRef = useRef<HTMLButtonElement>(null);
  const optionsRef = useRef<HTMLButtonElement>(null);
  // Whatever had focus when the game paused gets it back on Resume, across both views.
  const [opener] = useState(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );

  if (view === 'options') {
    return (
      <Dialog
        key="options"
        labelledBy="pause-options-title"
        returnFocusTo={null}
        onEscape={() => {
          setCameBack(true);
          setView('menu');
        }}
      >
        <OptionsPanel
          context="pause"
          headingId="pause-options-title"
          doneLabel="Back"
          onDone={() => {
            setCameBack(true);
            setView('menu');
          }}
        />
      </Dialog>
    );
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!RESUME_KEYS.has(event.code)) return;
    // Handled either way, so the game's keyboard source and the dialog ignore it.
    event.preventDefault();
    if (!event.repeat) onResume();
  };

  return (
    <Dialog
      key="menu"
      labelledBy="pause-title"
      describedBy="pause-message"
      initialFocus={cameBack ? optionsRef : resumeRef}
      returnFocusTo={opener}
      onKeyDown={onKeyDown}
    >
      <h2 id="pause-title" className={screen.heading}>
        Paused
      </h2>
      <p id="pause-message" className={screen.text}>
        {MESSAGES[reason]}
      </p>
      <div className={screen.actions}>
        <Button ref={resumeRef} onClick={onResume}>
          Resume
        </Button>
        <Button
          ref={optionsRef}
          onClick={() => {
            setView('options');
          }}
        >
          Options
        </Button>
        <Button onClick={onMainMenu}>Main menu</Button>
      </div>
    </Dialog>
  );
}
