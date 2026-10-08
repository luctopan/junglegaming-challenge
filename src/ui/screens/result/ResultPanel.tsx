import type { RefObject } from 'react';
import type { MatchSubmission } from '../../../api/contracts';
import { Button } from '../../components/Button';
import { formatDuration, spokenDuration } from '../../game/formatClock';
import screen from '../screen.module.css';
import { END_REASON_LABEL } from './endReason';
import { SubmissionStatus } from './SubmissionStatus';
import styles from './ResultPanel.module.css';

interface ResultPanelProps {
  readonly result: MatchSubmission;
  readonly headingId: string;
  readonly onPlayAgain: () => void;
  readonly onMainMenu: () => void;
  readonly playAgainRef?: RefObject<HTMLButtonElement | null>;
}

const MS_PER_SECOND = 1000;

/**
 * Result (assets/sample_result.png): score, time played, end reason, the
 * record's submission status (required by the spec, not in the mockup),
 * Play again and Main menu. Content of the in-game dialog and of `/result`.
 */
export function ResultPanel({
  result,
  headingId,
  onPlayAgain,
  onMainMenu,
  playAgainRef,
}: ResultPanelProps) {
  const defeated = result.endReason === 'defeated';
  const points = result.score === 1 ? 'Point' : 'Points';
  const reason = END_REASON_LABEL[result.endReason];
  return (
    <>
      <h2 id={headingId} className={screen.heading}>
        Battle complete
      </h2>
      <p className={styles.score} data-testid="result-score">
        {result.score}
      </p>
      {/* The compact mockup line for the eye, a full sentence for screen readers. */}
      <p
        className={`${screen.caps} ${styles.summary}`}
        data-testid="result-summary"
        aria-hidden="true"
      >
        {points} · {formatDuration(result.durationMs)} ·{' '}
        <span className={defeated ? styles.defeated : undefined}>{reason}</span>
      </p>
      <p className="visually-hidden">
        {points}. Time played: {spokenDuration(Math.floor(result.durationMs / MS_PER_SECOND))}.{' '}
        {reason}.
      </p>
      <SubmissionStatus matchId={result.matchId} />
      <div className={screen.actions}>
        <Button ref={playAgainRef} onClick={onPlayAgain}>
          Play again
        </Button>
        <Button onClick={onMainMenu}>Main menu</Button>
      </div>
    </>
  );
}
