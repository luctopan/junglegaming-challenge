import { useRef, useState } from 'react';
import { BrandLogo } from '../app/Backdrop';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { RoundButton } from '../components/RoundButton';
import { SoundToggle } from '../components/SoundToggle';
import screen from '../screens/screen.module.css';
import { audioStore, optionsStore, usePersistedValue } from '../state/settings';
import { Hud } from './Hud';
import { MatchEndPanel } from './MatchEndPanel';
import { matchConfig } from './matchConfig';
import { PauseDialog } from './PauseDialog';
import { TouchControls } from './TouchControls';
import { useGameSession } from './useGameSession';
import styles from './GameScreen.module.css';

interface GameScreenProps {
  readonly onExit: () => void;
}

/** Config for a new match from the Options saved right now. */
const nextMatchConfig = () => matchConfig(optionsStore.getSnapshot().value);

/**
 * Arena canvas, the loading/failure states that must resolve before combat
 * starts, and the in-match UI: HUD, on-screen controls, pause and end panels.
 * Everything here re-renders only on bridge store changes (≈ once per second).
 */
export function GameScreen({ onExit }: GameScreenProps) {
  const screenRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // The first match's config snapshot: later Options changes apply to the next match.
  const [config] = useState(nextMatchConfig);
  const { muted } = usePersistedValue(audioStore);
  const { snapshot, retryAssets, pause, resume, restart } = useGameSession(
    containerRef,
    screenRef,
    { config, muted },
  );
  const { assets, failure, phase, pauseReason, match } = snapshot;
  const inMatch = failure === null && match !== null && phase !== 'loading';
  const playing = phase === 'running' || phase === 'paused';

  return (
    <main ref={screenRef} className={styles.screen}>
      <div ref={containerRef} className={styles.arena} data-testid="arena" />
      <BrandLogo className={styles.logo} />

      {inMatch ? (
        <>
          <Hud match={match} />
          {playing ? (
            <>
              <TouchControls />
              <div className={styles.corner}>
                <SoundToggle />
                <RoundButton
                  label="Pause"
                  icon={{ atlas: 'pause' }}
                  aria-haspopup="dialog"
                  onClick={() => {
                    pause();
                  }}
                />
              </div>
            </>
          ) : null}
          {phase === 'paused' && pauseReason !== null ? (
            <PauseDialog reason={pauseReason} onResume={resume} onMainMenu={onExit} />
          ) : null}
          {phase === 'ended' ? (
            <MatchEndPanel
              match={match}
              onPlayAgain={() => {
                restart(nextMatchConfig());
              }}
              onMainMenu={onExit}
            />
          ) : null}
        </>
      ) : (
        <div className={styles.overlay}>
          {failure !== null ? (
            <Panel role="alert" aria-labelledby="failure-title">
              <h2 id="failure-title" className={screen.heading}>
                The game could not start
              </h2>
              <p className={screen.text}>{failure}</p>
              <ExitButton onExit={onExit} />
            </Panel>
          ) : assets.kind === 'error' ? (
            <Panel role="alert" aria-labelledby="assets-error-title">
              <h2 id="assets-error-title" className={screen.heading}>
                Could not load the game assets
              </h2>
              <p className={screen.text}>
                Check your connection and try again. The battle starts once everything is loaded.
              </p>
              <div className={screen.actions}>
                <Button onClick={retryAssets}>Retry</Button>
                <ExitButton onExit={onExit} />
              </div>
            </Panel>
          ) : (
            <Panel aria-labelledby="loading-title">
              <h2 id="loading-title" className={screen.heading}>
                Loading the fleet…
              </h2>
              <LoadingBar percent={assets.kind === 'loading' ? assets.percent : 100} />
              <ExitButton onExit={onExit} />
            </Panel>
          )}
        </div>
      )}
    </main>
  );
}

function LoadingBar({ percent }: { readonly percent: number }) {
  return (
    <>
      <div
        className={styles.progress}
        role="progressbar"
        aria-labelledby="loading-title"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className={styles.progressFill} style={{ width: `${percent}%` }} />
      </div>
      <p className={`${screen.text} ${styles.percent}`}>{percent}%</p>
    </>
  );
}

function ExitButton({ onExit }: { readonly onExit: () => void }) {
  return (
    <Button variant="secondary" size="small" onClick={onExit}>
      Main menu
    </Button>
  );
}
