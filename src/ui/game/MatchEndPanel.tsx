import { useRef } from 'react';
import type { MatchSnapshot } from '../../game/bridge/gameStore';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import screen from '../screens/screen.module.css';

interface MatchEndPanelProps {
  readonly match: MatchSnapshot;
  readonly onPlayAgain: () => void;
  readonly onMainMenu: () => void;
}

/** Temporary end-of-match panel; replaced by the Result screen in the next step. */
export function MatchEndPanel({ match, onPlayAgain, onMainMenu }: MatchEndPanelProps) {
  const playAgainRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog labelledBy="end-title" initialFocus={playAgainRef}>
      <h2 id="end-title" className={screen.heading}>
        {match.endReason === 'defeated' ? 'Your ship sank' : "Time's up"}
      </h2>
      <p className={screen.text}>
        Score: <span data-testid="end-score">{match.score}</span>
      </p>
      <div className={screen.actions}>
        <Button ref={playAgainRef} onClick={onPlayAgain}>
          Play again
        </Button>
        <Button onClick={onMainMenu}>Main menu</Button>
      </div>
    </Dialog>
  );
}
