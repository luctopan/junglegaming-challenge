import { lazy, Suspense, useState } from 'react';
import styles from './App.module.css';

// Pixi and the game runtime load with the first match, not with the menu.
const GameScreen = lazy(() =>
  import('../game/GameScreen').then((module) => ({ default: module.GameScreen })),
);

type Screen = 'menu' | 'game';

/** Placeholder navigation until the real menu and router land in Phase 4. */
export function App() {
  const [screen, setScreen] = useState<Screen>('menu');

  if (screen === 'game') {
    return (
      <Suspense fallback={<p className={styles.screen}>Preparing the fleet…</p>}>
        <GameScreen
          onExit={() => {
            setScreen('menu');
          }}
        />
      </Suspense>
    );
  }
  return (
    <main className={styles.screen}>
      <h1 className={styles.title}>Pirate Battle</h1>
      <p>Set sail. Take command.</p>
      <button
        type="button"
        className={styles.play}
        onClick={() => {
          setScreen('game');
        }}
      >
        Play
      </button>
    </main>
  );
}
