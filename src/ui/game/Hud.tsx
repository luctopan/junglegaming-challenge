import { memo } from 'react';
import type { HpTone, MatchSnapshot } from '../../game/bridge/gameStore';
import { AtlasIcon } from '../components/Icon';
import { uiImageSet } from '../components/uiArt';
import { formatClock } from './formatClock';
import { fillClipRight } from './hudBar';
import { useCommitCounter } from './useCommitCounter';
import styles from './Hud.module.css';

interface HudProps {
  readonly match: MatchSnapshot;
}

const FILL_ART: Readonly<Record<HpTone, string>> = {
  green: uiImageSet('hud', 'health_fill_green'),
  amber: uiImageSet('hud', 'health_fill_amber'),
  red: uiImageSet('hud', 'health_fill_red'),
};

/**
 * In-game HUD (assets/sample.png): the player's HP bar with its atlas frame
 * and a fill clipped to the HP ratio, then score and time counters. It gets
 * only the bridge's match snapshot, a new object only when a displayed value
 * changes, and `memo` skips every other parent render: it commits about once
 * per second, never per frame (counted for the e2e suite).
 */
export const Hud = memo(function Hud({ match }: HudProps) {
  useCommitCounter('hud');
  return (
    <div className={styles.hud} data-testid="hud">
      <div className={styles.health}>
        <AtlasIcon name="heart" className={styles.heart} />
        <div className={styles.bar}>
          <span
            className={styles.fill}
            style={{
              backgroundImage: FILL_ART[match.hpTone],
              clipPath: `inset(0 ${fillClipRight(match.hp, match.maxHp)}% 0 0)`,
            }}
            data-tone={match.hpTone}
          />
          <span className={styles.hpText}>
            <span className="visually-hidden">Hull </span>
            <span data-testid="hud-hp">
              {match.hp} / {match.maxHp}
            </span>
          </span>
        </div>
      </div>
      <div className={styles.counters}>
        <p className={styles.counter}>
          <AtlasIcon name="score" className={styles.counterIcon} />
          <span className="visually-hidden">Score </span>
          <span data-testid="hud-score">{match.score}</span>
        </p>
        <p className={styles.counter}>
          <AtlasIcon name="time" className={styles.counterIcon} />
          <span className="visually-hidden">Time left </span>
          <span data-testid="hud-time">{formatClock(match.secondsLeft)}</span>
        </p>
      </div>
    </div>
  );
});
