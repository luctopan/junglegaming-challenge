import { expect, test } from '../fixtures/test';
import {
  expectSessionReleased,
  leaveGame,
  resources,
  startGame,
  waitForArena,
} from '../helpers/game';

/**
 * Runs against the Vite dev server (project `dev-strict-mode`): React Strict
 * Mode only double-invokes effects in development, so the production bundle
 * cannot prove the mount → unmount → mount path. Pixi v8 initialises
 * asynchronously; the first, aborted session must leave nothing behind.
 */
test.describe('React Strict Mode', () => {
  test('a double mount ends with exactly one canvas, app and ticker callback', async ({
    page,
    openApp,
  }) => {
    await openApp('/?test=1');
    await startGame(page);
    await waitForArena(page);
    // Let the aborted first session's async init settle before counting.
    await page.waitForTimeout(500);

    expect(await page.locator('canvas').count()).toBe(1);
    expect(await resources(page)).toMatchObject({
      sessions: 1,
      applications: 1,
      canvases: 1,
      tickerCallbacks: 1,
      observers: 1,
    });

    await leaveGame(page);
    await expectSessionReleased(page);
  });

  test('leaving while assets are still loading aborts the boot cleanly', async ({
    page,
    openApp,
  }) => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.context().route('**/assets/ui/**', async (route) => {
      await held;
      await route.continue();
    });
    await openApp('/?test=1');
    await startGame(page);
    await expect(page.getByRole('progressbar')).toBeVisible();
    await leaveGame(page);
    release();
    // The pending load completes after the screen is gone: nothing may be created.
    await page.waitForTimeout(1000);
    await expectSessionReleased(page);
  });
});
