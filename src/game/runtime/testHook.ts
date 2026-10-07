import { commitCount } from '../../platform/commitCounters';
import type { ResourceCounts } from '../../platform/resourceCounters';
import { resourceCounts } from '../../platform/resourceCounters';
import { ManualClock } from '../../shared/clock';
import { MS_PER_SECOND } from '../../shared/math/constants';
import { cachedTextureCount } from '../render';
import { activeSessions, sessionInternals } from './gameSession';
import type { StateSnapshot } from './stateSnapshot';
import { enableTestControls, testControlsFromSearch } from './testControls';

/**
 * Resources alive in the page right now. After leaving the game screen every
 * count must be back to zero except `cachedTextures` (atlas textures are loaded
 * once and kept on purpose, so a second match costs no download).
 */
export interface ResourceReport extends ResourceCounts {
  readonly sessions: number;
  readonly canvases: number;
  readonly displayObjects: number;
  readonly cachedTextures: number;
}

/**
 * `window.__PIRATE_TEST__`, installed only in test mode (`?test=1`). It
 * controls *when* time passes (seed, manual clock, `advance`) and observes;
 * it has no way to change HP, positions, score or any other rule-driven
 * state, so combat tests must drive real keyboard/touch input.
 */
export interface PirateTestHook {
  resources(): ResourceReport;
  /** Seed of the next match (new game screen or restart). */
  setSeed(seed: number): void;
  /** Game sessions created from now on run on a clock that only `advance` moves. */
  useManualClock(): void;
  /** Moves the manual clock by `ms` in 60 Hz frames, running the real game loop for each. */
  advance(ms: number): void;
  /** State of the live match; null while no arena is shown. */
  snapshot(): StateSnapshot | null;
  /** Commits of the HUD component so far (it must follow the store, not the frame rate). */
  hudCommits(): number;
}

declare global {
  interface Window {
    __PIRATE_TEST__?: PirateTestHook;
  }
}

const FRAME_MS = MS_PER_SECOND / 60;

export function resourceReport(): ResourceReport {
  const sessions = activeSessions();
  return {
    ...resourceCounts(),
    sessions: sessions.length,
    canvases: document.querySelectorAll('canvas').length,
    displayObjects: sessions.reduce((sum, s) => sum + (s.stats()?.displayObjects ?? 0), 0),
    cachedTextures: cachedTextureCount(),
  };
}

/** `search` is the page's query string: `seed=<int>` and `clock=manual` preset the controls. */
export function installTestHook(target: Window, search: string): void {
  const controls = enableTestControls(testControlsFromSearch(search));

  target.__PIRATE_TEST__ = {
    resources: resourceReport,
    setSeed(seed) {
      if (!Number.isInteger(seed))
        throw new RangeError(`setSeed: expected an integer, got ${seed}`);
      controls.seed = seed;
    },
    useManualClock() {
      controls.manualClock ??= new ManualClock();
    },
    advance(ms) {
      const clock = controls.manualClock;
      if (clock === null) {
        throw new Error('advance() needs the manual clock: open the page with &clock=manual');
      }
      if (!Number.isFinite(ms) || ms < 0) {
        throw new RangeError(`advance: expected a finite ms >= 0, got ${ms}`);
      }
      for (let left = ms; left > 0; left -= FRAME_MS) {
        clock.advance(Math.min(FRAME_MS, left));
        for (const session of sessionInternals()) session.frame();
      }
    },
    snapshot() {
      const [session] = sessionInternals();
      return session?.snapshot() ?? null;
    },
    hudCommits: () => commitCount('hud'),
  };
}
