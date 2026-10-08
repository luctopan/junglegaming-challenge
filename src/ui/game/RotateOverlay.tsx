import { useEffect } from 'react';
import type { SessionPhase } from '../../game/bridge/gameStore';
import { Panel } from '../components/Panel';
import { TOUCH_PORTRAIT, useMediaQuery } from '../hooks/useMediaQuery';
import screen from '../screens/screen.module.css';
import styles from './GameScreen.module.css';

interface RotateOverlayProps {
  readonly phase: SessionPhase;
  readonly onPortrait: () => void;
}

/**
 * Gameplay is landscape-only on touch devices (docs/DECISIONS.md): in
 * portrait the arena would be too small to play. While portrait, this covers
 * the screen and pauses a running match; turning back shows the pause menu,
 * so resuming is still the player's action.
 */
export function RotateOverlay({ phase, onPortrait }: RotateOverlayProps) {
  const portrait = useMediaQuery(TOUCH_PORTRAIT);

  useEffect(() => {
    if (portrait && phase === 'running') onPortrait();
  }, [portrait, phase, onPortrait]);

  if (!portrait) return null;
  return (
    <div className={styles.rotate}>
      <Panel role="alert" aria-labelledby="rotate-title">
        <svg aria-hidden="true" viewBox="0 0 64 64" className={styles.rotateIcon}>
          <rect x="20" y="8" width="24" height="40" rx="4" />
          <path d="M14 52a22 22 0 0 0 36 0M50 52l-1-7M50 52l-7 1" />
        </svg>
        <h2 id="rotate-title" className={screen.heading}>
          Rotate your device
        </h2>
        <p className={screen.text}>The battle is played in landscape. The match is paused.</p>
      </Panel>
    </div>
  );
}
