import type { EndReason } from '../core';

/**
 * Low-frequency snapshot of the game for React (`useSyncExternalStore`). The
 * runtime may publish every frame; subscribers are only notified when a
 * displayed value changes (whole percent of loading, whole seconds, HP points),
 * so React never renders per frame.
 */

export type AssetStatus =
  | { readonly kind: 'loading'; readonly percent: number }
  | { readonly kind: 'ready' }
  | { readonly kind: 'error'; readonly message: string };

export type SessionPhase = 'loading' | 'running' | 'ended';

export interface MatchSnapshot {
  readonly score: number;
  /** Whole seconds, rounded up (shows 1 until the very end). */
  readonly secondsLeft: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly endReason: EndReason | null;
}

export interface GameSnapshot {
  readonly phase: SessionPhase;
  readonly assets: AssetStatus;
  readonly match: MatchSnapshot | null;
  /** The game cannot run (e.g. no WebGL); shown instead of the arena. */
  readonly failure: string | null;
}

/** `getSnapshot`/`subscribe` are plain functions so they can be passed to useSyncExternalStore. */
export interface GameStore {
  readonly getSnapshot: () => GameSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
  setAssets(status: AssetStatus): void;
  setPhase(phase: SessionPhase): void;
  publishMatch(match: MatchSnapshot): void;
  setFailure(message: string): void;
}

export const INITIAL_SNAPSHOT: GameSnapshot = Object.freeze({
  phase: 'loading',
  assets: Object.freeze({ kind: 'loading', percent: 0 }),
  match: null,
  failure: null,
});

const sameAssets = (a: AssetStatus, b: AssetStatus): boolean => {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'loading' && b.kind === 'loading') return a.percent === b.percent;
  if (a.kind === 'error' && b.kind === 'error') return a.message === b.message;
  return true;
};

const sameMatch = (a: MatchSnapshot | null, b: MatchSnapshot): boolean =>
  a !== null &&
  a.score === b.score &&
  a.secondsLeft === b.secondsLeft &&
  a.hp === b.hp &&
  a.maxHp === b.maxHp &&
  a.endReason === b.endReason;

/** Loading progress in whole percent, so the bar re-renders at most 100 times. */
export const toPercent = (progress: number): number =>
  Math.round(Math.min(1, Math.max(0, progress)) * 100);

export function createGameStore(initial: GameSnapshot = INITIAL_SNAPSHOT): GameStore {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  const commit = (next: GameSnapshot): void => {
    snapshot = next;
    for (const listener of listeners) listener();
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setAssets(status) {
      if (!sameAssets(snapshot.assets, status)) commit({ ...snapshot, assets: status });
    },
    setPhase(phase) {
      if (snapshot.phase !== phase) commit({ ...snapshot, phase });
    },
    publishMatch(match) {
      if (!sameMatch(snapshot.match, match)) commit({ ...snapshot, match: { ...match } });
    },
    setFailure(message) {
      if (snapshot.failure !== message) commit({ ...snapshot, failure: message });
    },
  };
}
