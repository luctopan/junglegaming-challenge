import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { profileStore } from '../state/settings';
import { ResultScreen } from '../screens/result/ResultScreen';
import { Backdrop } from './Backdrop';
import { clearMatchRequest, isMatchRequested, ROUTES, useAppNavigate } from './navigation';
import styles from './App.module.css';

// Pixi and the game runtime load with the first match, not with the menu.
const GameScreen = lazy(() =>
  import('../game/GameScreen').then((module) => ({ default: module.GameScreen })),
);

/**
 * Layout of `/play` and `/result`. It stays mounted while the URL moves
 * between them, so the arena and its session survive the end of a match and
 * Play again reuses the canvas. Opened directly (reload, history), `/play`
 * goes to the menu (the match is abandoned) and `/result` shows the last
 * stored result.
 */
export function MatchLayout() {
  const { pathname, search } = useLocation();
  const navigate = useAppNavigate();
  // Once live, a Strict Mode re-render or a later URL change never ends the match.
  const [live, setLive] = useState(canStartMatch);
  // Play again from a stored result (`/result` → `/play` in this same layout).
  if (!live && pathname === ROUTES.play && canStartMatch()) setLive(true);

  useEffect(() => {
    clearMatchRequest();
  }, [live]);

  const toMenu = useCallback(() => {
    navigate(ROUTES.menu);
  }, [navigate]);
  const toResult = useCallback(() => {
    navigate(ROUTES.result, { replace: true });
  }, [navigate]);
  const toPlay = useCallback(() => {
    navigate(ROUTES.play, { replace: true });
  }, [navigate]);

  if (!live) {
    if (pathname === ROUTES.result) return <ResultScreen />;
    return <Navigate to={{ pathname: ROUTES.menu, search }} replace />;
  }
  return (
    <Suspense fallback={<Preparing />}>
      <GameScreen onExit={toMenu} onMatchEnded={toResult} onRestarted={toPlay} />
    </Suspense>
  );
}

const canStartMatch = (): boolean =>
  isMatchRequested() && profileStore.getSnapshot().value !== null;

function Preparing() {
  return (
    <div className={styles.shell}>
      <Backdrop />
      <main className={styles.screen}>
        <p className={styles.message}>Preparing the fleet…</p>
      </main>
    </div>
  );
}
