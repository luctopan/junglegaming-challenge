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
}

/**
 * Owns one game session for the lifetime of the element in `containerRef`.
 * The effect's cleanup destroys the session, which aborts a boot still in
 * progress, so Strict Mode's mount → unmount → mount ends with exactly one
 * live session and one canvas.
 */
export function useGameSession(
  containerRef: RefObject<HTMLDivElement | null>,
  config: GameConfig,
): GameSessionHandle {
  const [store] = useState<GameStore>(createGameStore);
  const sessionRef = useRef<GameSession | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    const session = createGameSession({
      container,
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
  }, [containerRef, store, config]);

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return {
    snapshot,
    retryAssets: () => sessionRef.current?.retryAssets(),
  };
}
