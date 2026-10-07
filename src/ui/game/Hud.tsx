import { memo } from 'react';
import type { MatchSnapshot } from '../../game/bridge/gameStore';
import { formatClock } from './formatClock';
import styles from './GameScreen.module.css';
import { useCommitCounter } from './useCommitCounter';

interface HudProps {
  readonly match: MatchSnapshot;
}

/**
 * Temporary text HUD (Phase 4 replaces its look, not its data flow). It only
 * receives the bridge's match snapshot, a new object only when a displayed
 * value changes, and `memo` skips every other parent render, so it commits
 * about once per second, never per frame.
 */
export const Hud = memo(function Hud({ match }: HudProps) {
  useCommitCounter('hud');
  return (
    <div className={styles.hud} data-testid="hud">
      <p className={styles.hudItem}>
        <span className={styles.hudLabel}>HP</span>{' '}
        <span data-testid="hud-hp">
          {match.hp} / {match.maxHp}
        </span>
      </p>
      <p className={styles.hudItem}>
        <span className={styles.hudLabel}>Score</span>{' '}
        <span data-testid="hud-score">{match.score}</span>
      </p>
      <p className={styles.hudItem}>
        <span className={styles.hudLabel}>Time</span>{' '}
        <span data-testid="hud-time">{formatClock(match.secondsLeft)}</span>
      </p>
    </div>
  );
});
