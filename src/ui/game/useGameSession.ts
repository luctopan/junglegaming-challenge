import type { RefObject } from 'react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { GameConfig } from '../../config/gameConfig';
import type { GameSnapshot, GameStore } from '../../game/bridge/gameStore';
import { createGameStore } from '../../game/bridge/gameStore';
import type { GameSession } from '../../game/runtime';
import { createGameSession } from '../../game/runtime';
import { randomSeed } from '../../platform/random';

/** Generated runtime assets, served next to the app (see scripts/build-atlases.mjs). */
export const ASSET_BASE_PATH = `${import.meta.env.BASE_URL}assets/`;

export interface GameSessionHandle {
  readonly snapshot: GameSnapshot;
  readonly retryAssets: () => void;
  readonly pause: () => void;
  readonly resume: () => void;
  /** New match with a new seed on the same canvas. */
  readonly restart: () => void;
}

/**
 * Owns one game session for the lifetime of the element in `containerRef`.
 * The effect's cleanup destroys the session, which aborts a boot still in
 * progress, so Strict Mode's mount → unmount → mount ends with exactly one
 * live session and one canvas. Unmounting mid-match abandons it (never
 * recorded): leaving the screen, Main menu and page reload all end here.
 */
export function useGameSession(
  containerRef: RefObject<HTMLDivElement | null>,
  controlsRef: RefObject<HTMLElement | null>,
  config: GameConfig,
): GameSessionHandle {
  const [store] = useState<GameStore>(createGameStore);
  const sessionRef = useRef<GameSession | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    const session = createGameSession({
      container,
      controlsRoot: controlsRef.current,
      store,
      config,
      seed: randomSeed(),
      assetBasePath: ASSET_BASE_PATH,
    });
    sessionRef.current = session;
    return () => {
      sessionRef.current = null;
      session.destroy();
    };
  }, [containerRef, controlsRef, store, config]);

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return {
    snapshot,
    retryAssets: () => sessionRef.current?.retryAssets(),
    pause: () => sessionRef.current?.pause('manual'),
    resume: () => sessionRef.current?.resume(),
    restart: () => sessionRef.current?.restart(randomSeed()),
  };
}
