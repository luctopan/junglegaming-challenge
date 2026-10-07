import type { Page } from '@playwright/test';
import { expect } from '../fixtures/test';

/**
 * Mirror of `ResourceReport` (src/game/runtime/testHook.ts). Kept local because
 * the e2e project is typechecked without the DOM lib the app sources need.
 */
export interface ResourceReport {
  applications: number;
  tickerCallbacks: number;
  listeners: number;
  observers: number;
  dynamicTextures: number;
  audioLoops: number;
  sessions: number;
  canvases: number;
  displayObjects: number;
  cachedTextures: number;
}

interface TestWindow {
  __PIRATE_TEST__?: { resources(): ResourceReport };
}

export async function resources(page: Page): Promise<ResourceReport> {
  return page.evaluate(() => {
    const hook = (globalThis as unknown as TestWindow).__PIRATE_TEST__;
    if (hook === undefined) throw new Error('Test hook missing: open the app with ?test=1');
    return hook.resources();
  });
}

/** Everything a game screen owns; all of it must be gone after leaving the screen. */
export const SESSION_RESOURCES = [
  'applications',
  'tickerCallbacks',
  'listeners',
  'observers',
  'dynamicTextures',
  'audioLoops',
  'sessions',
  'canvases',
  'displayObjects',
] as const satisfies readonly (keyof ResourceReport)[];

export async function startGame(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Play' }).click();
}

/**
 * WebGL start-up in headless Chromium runs on a software rasterizer: ~1 s alone,
 * several seconds with parallel workers and both web servers busy (asset
 * loading itself takes ~0.1 s). Real GPUs start in a fraction of that.
 */
const ARENA_START_TIMEOUT_MS = 15_000;

/** Waits until the arena canvas is attached and the loading overlay is gone. */
export async function waitForArena(page: Page): Promise<void> {
  await expect(page.getByTestId('arena').locator('canvas')).toHaveCount(1, {
    timeout: ARENA_START_TIMEOUT_MS,
  });
  await expect(page.getByRole('progressbar')).toHaveCount(0);
}

export async function leaveGame(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Main menu' }).click();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
}

export async function expectSessionReleased(page: Page): Promise<void> {
  const report = await resources(page);
  for (const key of SESSION_RESOURCES) expect(report[key], key).toBe(0);
}
