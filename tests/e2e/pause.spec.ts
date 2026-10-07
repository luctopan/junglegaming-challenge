import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/test';
import type { BrowserGlobals } from './helpers/game';
import { advance, holdKey, openMatch, snapshot, startGame, waitForArena } from './helpers/game';

async function setTabHidden(page: Page, hidden: boolean): Promise<void> {
  await page.evaluate((isHidden) => {
    const dom = globalThis as unknown as BrowserGlobals;
    Object.defineProperty(dom.document, 'visibilityState', {
      configurable: true,
      get: () => (isHidden ? 'hidden' : 'visible'),
    });
    (dom.document as unknown as EventTarget).dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

async function blurWindow(page: Page, type: 'blur' | 'focus'): Promise<void> {
  await page.evaluate((eventType) => {
    (globalThis as unknown as BrowserGlobals).dispatchEvent(new Event(eventType));
  }, type);
}

/** Everything that must stand still while paused. */
const frozenState = (state: Awaited<ReturnType<typeof snapshot>>) => ({
  stepCount: state.stepCount,
  timeLeftSeconds: state.timeLeftSeconds,
  player: state.player,
  enemies: state.enemies,
  projectiles: state.projectiles,
});

test.describe('pause', () => {
  test('manual pause freezes timer, cooldowns, enemies and projectiles', async ({
    page,
    openApp,
  }) => {
    await openMatch(page, openApp);
    await page.keyboard.press('Space');
    await advance(page, 3500); // the first enemy spawns at 3 s
    await page.keyboard.press('KeyQ');
    await advance(page, 100);
    const before = await snapshot(page);
    expect(before.enemies.length).toBeGreaterThan(0);
    const time = await page.getByTestId('hud-time').textContent();

    await page.getByRole('button', { name: 'Pause' }).click();
    const dialog = page.getByRole('dialog', { name: 'Paused' });
    await expect(dialog).toContainText('Ready when you are.');
    await advance(page, 10_000);
    // Game keys do nothing in the pause menu.
    await holdKey(page, 'KeyW', 500);
    const paused = await snapshot(page);
    expect(paused.phase).toBe('paused');
    expect(paused.pauseReason).toBe('manual');
    expect(frozenState(paused)).toEqual(frozenState(before));
    await expect(page.getByTestId('hud-time')).toHaveText(time ?? '');

    await dialog.getByRole('button', { name: 'Resume' }).click();
    await advance(page, 1000);
    const resumed = await snapshot(page);
    expect(resumed.phase).toBe('running');
    // Only the second of play after resuming counts (the first frame sets the baseline).
    expect(resumed.stepCount - before.stepCount).toBeGreaterThanOrEqual(59);
    expect(resumed.stepCount - before.stepCount).toBeLessThanOrEqual(60);
  });

  test('auto-pauses on window blur; focus alone does not resume', async ({ page, openApp }) => {
    await openMatch(page, openApp);
    await page.keyboard.down('KeyW');
    await advance(page, 200);
    await blurWindow(page, 'blur');

    const dialog = page.getByRole('dialog', { name: 'Paused' });
    await expect(dialog).toContainText('background');
    const paused = await snapshot(page);
    expect(paused).toMatchObject({ phase: 'paused', pauseReason: 'blur', inputIdle: true });

    await blurWindow(page, 'focus');
    await advance(page, 1000);
    await expect(dialog).toBeVisible();
    expect((await snapshot(page)).stepCount).toBe(paused.stepCount);
    await page.keyboard.up('KeyW');
  });

  test('auto-pauses when the tab is hidden; showing it again does not resume', async ({
    page,
    openApp,
  }) => {
    await openMatch(page, openApp);
    await advance(page, 500);
    await setTabHidden(page, true);
    const dialog = page.getByRole('dialog', { name: 'Paused' });
    await expect(dialog).toContainText('hidden');
    const paused = await snapshot(page);
    expect(paused).toMatchObject({ phase: 'paused', pauseReason: 'hidden' });

    await setTabHidden(page, false);
    await advance(page, 2000);
    await expect(dialog).toBeVisible();
    expect((await snapshot(page)).stepCount).toBe(paused.stepCount);

    await page.getByRole('button', { name: 'Resume' }).click();
    await advance(page, 500);
    expect((await snapshot(page)).stepCount).toBeGreaterThan(paused.stepCount);
  });

  test('no timer drift on the real clock: paused wall time is never simulated', async ({
    page,
    openApp,
  }) => {
    await openApp('/?test=1&seed=42');
    await startGame(page);
    await waitForArena(page);
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Pause' }).click();
    const atPause = await snapshot(page);

    await page.waitForTimeout(2000);
    expect((await snapshot(page)).elapsedSeconds).toBe(atPause.elapsedSeconds);

    const resumedAt = Date.now();
    await page.getByRole('button', { name: 'Resume' }).click();
    await page.waitForTimeout(1000);
    const after = await snapshot(page);
    const wallSeconds = (Date.now() - resumedAt) / 1000;
    const simulated = after.elapsedSeconds - atPause.elapsedSeconds;
    // Simulated time tracks the wall time since Resume, never the 2 s spent paused.
    // Lower bound kept loose: the headless software rasterizer may render few frames.
    expect(simulated).toBeGreaterThan(0.2);
    expect(simulated).toBeLessThanOrEqual(wallSeconds + 0.05);
  });
});
