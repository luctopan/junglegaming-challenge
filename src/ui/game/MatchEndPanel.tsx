import { useEffect, useRef } from 'react';
import type { MatchSnapshot } from '../../game/bridge/gameStore';
import styles from './GameScreen.module.css';

interface MatchEndPanelProps {
  readonly match: MatchSnapshot;
  readonly onPlayAgain: () => void;
  readonly onMainMenu: () => void;
}

/** Temporary end-of-match panel; the Result screen with submission status is Phase 4/5. */
export function MatchEndPanel({ match, onPlayAgain, onMainMenu }: MatchEndPanelProps) {
  const playAgainRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    playAgainRef.current?.focus();
  }, []);

  return (
    <div className={styles.backdrop}>
      <section
        className={styles.overlay}
        role="dialog"
        aria-modal="true"
        aria-labelledby="end-title"
      >
        <h2 id="end-title">{match.endReason === 'defeated' ? 'Your ship sank' : "Time's up"}</h2>
        <p>
          Score: <span data-testid="end-score">{match.score}</span>
        </p>
        <button ref={playAgainRef} type="button" className={styles.button} onClick={onPlayAgain}>
          Play again
        </button>
        <button type="button" className={styles.button} onClick={onMainMenu}>
          Main menu
        </button>
      </section>
    </div>
  );
}
