import { useEffect, useRef, useState } from 'react';
import { newUuid } from '../../platform/uuid';
import { BrandLogo } from '../app/Backdrop';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { RoundButton } from '../components/RoundButton';
import { SoundToggle } from '../components/SoundToggle';
import screen from '../screens/screen.module.css';
import { ResultPanel } from '../screens/result/ResultPanel';
import {
  audioStore,
  lastResultStore,
  optionsStore,
  profileStore,
  usePersistedValue,
} from '../state/settings';
import { Dialog } from '../components/Dialog';
import { Hud } from './Hud';
import { matchConfig } from './matchConfig';
import { buildMatchResult } from './matchResult';
import { PauseDialog } from './PauseDialog';
import { TouchControls } from './TouchControls';
import { useGameSession } from './useGameSession';
import styles from './GameScreen.module.css';

interface GameScreenProps {
  readonly onExit: () => void;
  /** The match ended and its result is stored (the URL moves to /result). */
  readonly onMatchEnded: () => void;
  /** Play again started a new match on the same canvas (the URL moves back to /play). */
  readonly onRestarted: () => void;
}

/** Config for a new match from the Options saved right now. */
const nextMatchConfig = () => matchConfig(optionsStore.getSnapshot().value);

/**
 * Arena canvas, the loading/failure states that must resolve before combat
 * starts, and the in-match UI: HUD, on-screen controls, pause and end panels.
 * Everything here re-renders only on bridge store changes (≈ once per second).
 */
export function GameScreen({ onExit, onMatchEnded, onRestarted }: GameScreenProps) {
  const screenRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // The first match's config snapshot: later Options changes apply to the next match.
  const [config] = useState(nextMatchConfig);
  // Identity and config of the match on screen (a new one on every Play again).
  const [matchId, setMatchId] = useState(newUuid);
  const matchConfigRef = useRef(config);
  const playAgainRef = useRef<HTMLButtonElement>(null);
  const lastResult = usePersistedValue(lastResultStore);
  const { muted } = usePersistedValue(audioStore);
  const { snapshot, retryAssets, pause, resume, restart } = useGameSession(
    containerRef,
    screenRef,
    { config, muted },
  );
  const { assets, failure, phase, pauseReason, match } = snapshot;
  const inMatch = failure === null && match !== null && phase !== 'loading';
  const playing = phase === 'running' || phase === 'paused';
  const result = lastResult?.matchId === matchId ? lastResult : null;

  // Records the result once, when the match ends: `playedAt` is fixed here, and the
  // stored result keyed by matchId makes a repeated effect (Strict Mode) a no-op.
  useEffect(() => {
    if (phase !== 'ended' || match === null || result !== null) return;
    const captain = profileStore.getSnapshot().value;
    if (captain === null) return;
    const built = buildMatchResult(
      match,
      { matchId, captain, config: matchConfigRef.current },
      new Date(),
    );
    if (built === null) return;
    lastResultStore.set(built);
    onMatchEnded();
  }, [phase, match, matchId, result, onMatchEnded]);

  const playAgain = (): void => {
    matchConfigRef.current = nextMatchConfig();
    setMatchId(newUuid());
    restart(matchConfigRef.current);
    onRestarted();
  };

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
          {phase === 'ended' && result !== null ? (
            <Dialog labelledBy="result-title" initialFocus={playAgainRef}>
              <ResultPanel
                result={result}
                submission={{ kind: 'local' }}
                headingId="result-title"
                playAgainRef={playAgainRef}
                onPlayAgain={playAgain}
                onMainMenu={onExit}
              />
            </Dialog>
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
