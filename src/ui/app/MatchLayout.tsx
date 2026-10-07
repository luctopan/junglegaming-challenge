import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Backdrop } from './Backdrop';
import { clearMatchRequest, isMatchRequested, ROUTES, useAppNavigate } from './navigation';
import styles from './App.module.css';

// Pixi and the game runtime load with the first match, not with the menu.
const GameScreen = lazy(() =>
  import('../game/GameScreen').then((module) => ({ default: module.GameScreen })),
);

/**
 * Layout of `/play` and `/result`. It stays mounted while the URL moves
 * between them, so the arena and its session survive the end of a match.
 * Opening `/play` without an in-app Play (reload, history) goes to the menu.
 */
export function MatchLayout() {
  // Read once: a Strict Mode re-render or a later URL change must not end the match.
  const [live] = useState(isMatchRequested);
  const { search } = useLocation();
  const navigate = useAppNavigate();

  useEffect(() => {
    clearMatchRequest();
  }, []);

  if (!live) return <Navigate to={{ pathname: ROUTES.menu, search }} replace />;
  return (
    <Suspense fallback={<Preparing />}>
      <GameScreen
        onExit={() => {
          navigate(ROUTES.menu);
        }}
      />
    </Suspense>
  );
}

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
