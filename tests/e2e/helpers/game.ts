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

/** Mirror of `StateSnapshot` (src/game/runtime/stateSnapshot.ts). */
export interface StateSnapshot {
  phase: 'loading' | 'running' | 'paused' | 'ended';
  pauseReason: 'manual' | 'blur' | 'hidden' | null;
  endReason: 'time_up' | 'defeated' | null;
  stepCount: number;
  elapsedSeconds: number;
  timeLeftSeconds: number;
  score: number;
  player: {
    x: number;
    y: number;
    heading: number;
    speed: number;
    hp: number;
    maxHp: number;
    alive: boolean;
    cooldowns: { front: number; left: number; right: number };
  };
  enemies: {
    id: number;
    kind: 'chaser' | 'shooter';
    x: number;
    y: number;
    hp: number;
    alive: boolean;
  }[];
  projectiles: {
    team: 'player' | 'enemy';
    cannon: 'front' | 'broadside' | 'shooterCannon';
    x: number;
    y: number;
  }[];
  inputIdle: boolean;
}

interface TestHook {
  resources(): ResourceReport;
  advance(ms: number): void;
  snapshot(): StateSnapshot | null;
  hudCommits(): number;
  framesRendered(): number;
}

interface TestWindow {
  __PIRATE_TEST__?: TestHook;
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

export const DEFAULT_TEST_SEED = 42;

/**
 * Opens a running match on a manual clock: simulation time moves only with
 * `advance`, so input timing in the tests is step-exact (PLAN §4).
 */
export async function openMatch(
  page: Page,
  openApp: (path?: string) => Promise<void>,
  query = '',
): Promise<void> {
  await openApp(`/?test=1&seed=${DEFAULT_TEST_SEED}&clock=manual${query}`);
  await startGame(page);
  await waitForArena(page);
  await expect.poll(async () => (await snapshot(page)).phase).toBe('running');
}

export async function snapshot(page: Page): Promise<StateSnapshot> {
  const state = await page.evaluate(
    () => (globalThis as unknown as TestWindow).__PIRATE_TEST__?.snapshot() ?? null,
  );
  if (state === null) throw new Error('No match on screen');
  return state;
}

/**
 * Advances simulation time through the real game loop (60 Hz frames). Long
 * spans are split so React can render between chunks, like real frames would.
 */
export async function advance(page: Page, ms: number, chunkMs = 1000): Promise<void> {
  for (let left = ms; left > 0; left -= chunkMs) {
    await page.evaluate(
      (span) => {
        (globalThis as unknown as TestWindow).__PIRATE_TEST__?.advance(span);
      },
      Math.min(chunkMs, left),
    );
  }
}

export async function hudCommits(page: Page): Promise<number> {
  return page.evaluate(
    () => (globalThis as unknown as TestWindow).__PIRATE_TEST__?.hudCommits() ?? 0,
  );
}

/** Frames rendered so far (ticker frames and on-demand renders). */
export async function framesRendered(page: Page): Promise<number> {
  return page.evaluate(
    () => (globalThis as unknown as TestWindow).__PIRATE_TEST__?.framesRendered() ?? 0,
  );
}

/** Holds a key (by `KeyboardEvent.code`-style name) for `ms` of simulation time. */
export async function holdKey(page: Page, key: string, ms: number): Promise<void> {
  await page.keyboard.down(key);
  await advance(page, ms);
  await page.keyboard.up(key);
}

/**
 * Dispatches a synthetic keydown on the focused element (bubbling to the
 * window like a real one) and reports whether the app prevented its default.
 * Used for what Playwright's keyboard cannot produce: auto-repeat and other
 * layouts (a different `key` for the same physical `code`).
 */
export async function dispatchKey(
  page: Page,
  type: 'keydown' | 'keyup',
  init: { code: string; key: string; repeat?: boolean },
): Promise<boolean> {
  return page.evaluate(
    ({ type, init }) => {
      const dom = globalThis as unknown as BrowserGlobals;
      const event = new dom.KeyboardEvent(type, { ...init, bubbles: true, cancelable: true });
      (dom.document.activeElement ?? dom.document.body).dispatchEvent(event);
      return event.defaultPrevented;
    },
    { type, init },
  );
}

/** The few browser globals used inside `page.evaluate` (the e2e tsconfig has no DOM lib). */
export interface BrowserGlobals {
  KeyboardEvent: new (type: string, init: Record<string, unknown>) => Event;
  MouseEvent: new (type: string, init: Record<string, unknown>) => Event;
  document: {
    activeElement: EventTarget | null;
    body: EventTarget;
    visibilityState: string;
    querySelector(selector: string): EventTarget | null;
  };
  getComputedStyle(element: EventTarget): { touchAction: string; userSelect: string };
  dispatchEvent(event: Event): boolean;
}

export async function leaveGame(page: Page): Promise<void> {
  const pause = page.getByRole('button', { name: 'Pause' });
  if (await pause.isVisible()) await pause.click();
  await page.getByRole('button', { name: 'Main menu' }).click();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
}

export async function expectSessionReleased(page: Page): Promise<void> {
  const report = await resources(page);
  for (const key of SESSION_RESOURCES) expect(report[key], key).toBe(0);
}
