import { useRef } from 'react';
import { DEFAULT_GAME_CONFIG } from '../../config/defaults';
import styles from './GameScreen.module.css';
import { useGameSession } from './useGameSession';

interface GameScreenProps {
  readonly onExit: () => void;
}

/**
 * Arena canvas plus the loading/failure states that must resolve before combat
 * starts. The HUD, pause menu and touch controls arrive in Phases 3–4.
 */
export function GameScreen({ onExit }: GameScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { snapshot, retryAssets } = useGameSession(containerRef, DEFAULT_GAME_CONFIG);
  const { assets, failure } = snapshot;

  return (
    <main className={styles.screen}>
      <div ref={containerRef} className={styles.arena} data-testid="arena" />

      {failure !== null ? (
        <section className={styles.overlay} role="alert">
          <h2>The game could not start</h2>
          <p>{failure}</p>
        </section>
      ) : assets.kind === 'loading' ? (
        <section className={styles.overlay} aria-labelledby="loading-title">
          <h2 id="loading-title">Loading the fleet…</h2>
          <div
            className={styles.progress}
            role="progressbar"
            aria-labelledby="loading-title"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={assets.percent}
          >
            <div className={styles.progressFill} style={{ width: `${assets.percent}%` }} />
          </div>
          <p className={styles.percent}>{assets.percent}%</p>
        </section>
      ) : assets.kind === 'error' ? (
        <section className={styles.overlay} role="alert" aria-labelledby="assets-error-title">
          <h2 id="assets-error-title">Could not load the game assets</h2>
          <p>Check your connection and try again. The battle starts once everything is loaded.</p>
          <button type="button" className={styles.button} onClick={retryAssets}>
            Retry
          </button>
        </section>
      ) : null}

      <button type="button" className={`${styles.button} ${styles.exit}`} onClick={onExit}>
        Main menu
      </button>
    </main>
  );
}
