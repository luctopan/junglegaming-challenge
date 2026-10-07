import { useRef, useState } from 'react';
import styles from './GameScreen.module.css';
import { Hud } from './Hud';
import { MatchEndPanel } from './MatchEndPanel';
import { matchConfig } from './matchConfig';
import { PauseDialog } from './PauseDialog';
import { TouchControls } from './TouchControls';
import { useGameSession } from './useGameSession';

interface GameScreenProps {
  readonly onExit: () => void;
}

/**
 * Arena canvas, the loading/failure states that must resolve before combat
 * starts, and the in-match UI: HUD, on-screen controls, pause and end panels.
 * Everything here re-renders only on bridge store changes (≈ once per second).
 */
export function GameScreen({ onExit }: GameScreenProps) {
  const screenRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [config] = useState(matchConfig);
  const { snapshot, retryAssets, pause, resume, restart } = useGameSession(
    containerRef,
    screenRef,
    config,
  );
  const { assets, failure, phase, pauseReason, match } = snapshot;
  const inMatch = failure === null && match !== null && phase !== 'loading';

  return (
    <main ref={screenRef} className={styles.screen}>
      <div ref={containerRef} className={styles.arena} data-testid="arena" />

      {inMatch ? (
        <>
          <Hud match={match} />
          {phase === 'running' || phase === 'paused' ? <TouchControls /> : null}
          {phase === 'running' ? (
            <button
              type="button"
              className={`${styles.button} ${styles.pause}`}
              aria-label="Pause"
              onClick={pause}
            >
              <span aria-hidden="true">❚❚</span>
            </button>
          ) : null}
          {phase === 'paused' && pauseReason !== null ? (
            <PauseDialog reason={pauseReason} onResume={resume} onMainMenu={onExit} />
          ) : null}
          {phase === 'ended' ? (
            <MatchEndPanel match={match} onPlayAgain={restart} onMainMenu={onExit} />
          ) : null}
        </>
      ) : failure !== null ? (
        <section className={styles.overlay} role="alert">
          <h2>The game could not start</h2>
          <p>{failure}</p>
          <ExitButton onExit={onExit} />
        </section>
      ) : assets.kind === 'error' ? (
        <section className={styles.overlay} role="alert" aria-labelledby="assets-error-title">
          <h2 id="assets-error-title">Could not load the game assets</h2>
          <p>Check your connection and try again. The battle starts once everything is loaded.</p>
          <button type="button" className={styles.button} onClick={retryAssets}>
            Retry
          </button>
          <ExitButton onExit={onExit} />
        </section>
      ) : (
        <section className={styles.overlay} aria-labelledby="loading-title">
          <h2 id="loading-title">Loading the fleet…</h2>
          <div
            className={styles.progress}
            role="progressbar"
            aria-labelledby="loading-title"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={assets.kind === 'loading' ? assets.percent : 100}
          >
            <div
              className={styles.progressFill}
              style={{ width: `${assets.kind === 'loading' ? assets.percent : 100}%` }}
            />
          </div>
          <p className={styles.percent}>{assets.kind === 'loading' ? assets.percent : 100}%</p>
          <ExitButton onExit={onExit} />
        </section>
      )}
    </main>
  );
}

function ExitButton({ onExit }: { readonly onExit: () => void }) {
  return (
    <button type="button" className={styles.button} onClick={onExit}>
      Main menu
    </button>
  );
}
