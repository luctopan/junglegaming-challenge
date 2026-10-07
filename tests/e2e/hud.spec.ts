import { expect, test } from './fixtures/test';
import { advance, hudCommits, openMatch, snapshot, startGame, waitForArena } from './helpers/game';

/**
 * The HUD reads only the bridge store, which emits when a displayed value
 * changes (whole seconds, HP, score). The test hook counts HUD commits.
 */
test.describe('HUD', () => {
  test('shows score, time left and HP from the bridge', async ({ page, openApp }) => {
    await openMatch(page, openApp);
    await expect(page.getByTestId('hud-hp')).toHaveText('200 / 200');
    await expect(page.getByTestId('hud-score')).toHaveText('0');
    await expect(page.getByTestId('hud-time')).toHaveText('02:00');
    await advance(page, 1500);
    await expect(page.getByTestId('hud-time')).toHaveText('01:59');
  });

  test('commits about once per second, never per frame (manual clock)', async ({
    page,
    openApp,
  }) => {
    await openMatch(page, openApp);
    const before = await hudCommits(page);
    // 300 frames in 100 ms chunks, so React gets the chance to render between them.
    await advance(page, 5000, 100);
    await expect(page.getByTestId('hud-time')).toHaveText('01:55');
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

test.describe('HUD health bar', () => {
  test('the fill is clipped to the HP and changes colour with it', async ({ page, openApp }) => {
    await openMatch(page, openApp);
    const fill = page.getByTestId('hud').locator('[data-tone]');
    await expect(fill).toHaveAttribute('data-tone', 'green');
    const clipAt = async () =>
      Number(
        /inset\(0px ([\d.]+)%/.exec(
          await fill.evaluate(
            (e) => (e as unknown as { style: { clipPath: string } }).style.clipPath,
          ),
        )?.[1],
      );
    const full = await clipAt();

    // Sit still until the enemies have hit the ship (seeded, so always the same fight).
    for (let i = 0; i < 30 && (await snapshot(page)).player.hp === 200; i++) {
      await advance(page, 2000);
    }
    const hit = await snapshot(page);
    expect(hit.player.hp).toBeLessThan(200);
    await expect(page.getByTestId('hud-hp')).toHaveText(`${Math.ceil(hit.player.hp)} / 200`);
    expect(await clipAt()).toBeGreaterThan(full);
  });
});
