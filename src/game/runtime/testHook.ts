import type { ResourceCounts } from '../../platform/resourceCounters';
import { resourceCounts } from '../../platform/resourceCounters';
import { cachedTextureCount } from '../render';
import { activeSessions } from './gameSession';

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
 * `window.__PIRATE_TEST__`, installed only in test mode. It observes; it has no
 * way to change game state (combat tests drive real keyboard/touch input).
 * Phase 3 adds seed and clock control.
 */
export interface PirateTestHook {
  resources(): ResourceReport;
}

declare global {
  interface Window {
    __PIRATE_TEST__?: PirateTestHook;
  }
}

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

export function installTestHook(target: Window): void {
  target.__PIRATE_TEST__ = { resources: resourceReport };
}
