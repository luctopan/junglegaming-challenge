import { expect, test } from './fixtures/test';
import {
  advance,
  framesRendered,
  openMatch,
  snapshot,
  startGame,
  waitForArena,
} from './helpers/game';

/**
 * Rendering costs CPU (WebGL runs on the CPU in headless Chromium and on many
 * low-end devices), so frames are drawn only when they can change: never
 * while paused, and on demand under the test manual clock.
 */
test.describe('rendering on demand', () => {
  test('under the manual clock, advance renders exactly one frame', async ({ page, openApp }) => {
    await openMatch(page, openApp);
    const idle = await framesRendered(page);
    await page.waitForTimeout(500);
    expect(await framesRendered(page)).toBe(idle);

    await advance(page, 2000, 2000);
    expect(await framesRendered(page)).toBe(idle + 1);
    expect((await snapshot(page)).stepCount).toBe(120);

    await advance(page, 2000, 500);
    expect(await framesRendered(page)).toBe(idle + 5);
  });

  test('a paused match renders no frames until it resumes (real clock)', async ({
    page,
    openApp,
  }) => {
    await openApp('/?test=1&seed=42');
    await startGame(page);
    await waitForArena(page);
    await expect.poll(() => framesRendered(page)).toBeGreaterThan(5);

    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
    const paused = await framesRendered(page);
    await page.waitForTimeout(1000);
    expect(await framesRendered(page)).toBe(paused);

    await page.getByRole('button', { name: 'Resume' }).click();
    await expect.poll(() => framesRendered(page)).toBeGreaterThan(paused + 5);
  });
});
