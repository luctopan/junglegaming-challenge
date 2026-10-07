import { expect, test } from './fixtures/test';
import { advance, hudCommits, openMatch, startGame, waitForArena } from './helpers/game';

/**
 * The HUD reads only the bridge store, which emits when a displayed value
 * changes (whole seconds, HP, score). The test hook counts HUD commits.
 */
test.describe('HUD', () => {
  test('shows score, time left and HP from the bridge', async ({ page, openApp }) => {
    await openMatch(page, openApp);
    await expect(page.getByTestId('hud-hp')).toHaveText('200 / 200');
    await expect(page.getByTestId('hud-score')).toHaveText('0');
    await expect(page.getByTestId('hud-time')).toHaveText('2:00');
    await advance(page, 1500);
    await expect(page.getByTestId('hud-time')).toHaveText('1:59');
  });

  test('commits about once per second, never per frame (manual clock)', async ({
    page,
    openApp,
  }) => {
    await openMatch(page, openApp);
    const before = await hudCommits(page);
    // 300 frames in 100 ms chunks, so React gets the chance to render between them.
    await advance(page, 5000, 100);
    await expect(page.getByTestId('hud-time')).toHaveText('1:55');
    const commits = (await hudCommits(page)) - before;
    // 5 timer changes, plus HP/score changes if an enemy arrives: far below 300.
    expect(commits).toBeGreaterThanOrEqual(5);
    expect(commits).toBeLessThanOrEqual(12);
  });

  test('commits about once per second on the real clock', async ({ page, openApp }) => {
    await openApp('/?test=1&seed=42');
    await startGame(page);
    await waitForArena(page);
    const before = await hudCommits(page);
    await page.waitForTimeout(2000);
    expect((await hudCommits(page)) - before).toBeLessThanOrEqual(6);
  });

  test('balance overrides in the URL are ignored by the production build', async ({
    page,
    openApp,
  }) => {
    await openMatch(page, openApp, '&cfg.ships.player.maxHp=150');
    await expect(page.getByTestId('hud-hp')).toHaveText('200 / 200');
  });
});
