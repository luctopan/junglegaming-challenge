import type { Page } from '@playwright/test';
import {
  expect,
  OPTIONS_KEY,
  readStorage,
  seedStorage,
  test,
  TEST_PLAYER_ID,
} from './fixtures/test';
import { advance, openMatch, snapshot, waitForArena } from './helpers/game';

const LAST_RESULT_KEY = 'pirate.lastResult.v1';

/** One-minute matches, so playing to the end stays quick. */
async function shortMatches(page: Page): Promise<void> {
  await seedStorage(
    page,
    OPTIONS_KEY,
    JSON.stringify({ sessionSeconds: 60, spawnIntervalSeconds: 10 }),
  );
}

/** Runs the match until it ends (time up, or earlier if the idle ship sinks). */
async function playToTheEnd(page: Page): Promise<void> {
  await advance(page, 61_000, 5_000);
  expect((await snapshot(page)).phase).toBe('ended');
}

/** `mm:ss` of the played time, rounded down like the Result screen. */
const played = (seconds: number): string => {
  const whole = Math.floor(seconds + 1e-6);
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
};

const reasonLabel = (reason: string | null): string =>
  reason === 'defeated' ? 'Defeated' : 'Time up';

test.describe('result', () => {
  test('shows score, time played, end reason and record status at /result', async ({
    page,
    openApp,
  }) => {
    await shortMatches(page);
    await openMatch(page, openApp);
    await playToTheEnd(page);
    const state = await snapshot(page);

    const dialog = page.getByRole('dialog', { name: 'Battle complete' });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/result\?/);
    await expect(dialog.getByTestId('result-score')).toHaveText(String(state.score));
    await expect(dialog.getByTestId('result-summary')).toHaveText(
      new RegExp(`Points? · ${played(state.elapsedSeconds)} · ${reasonLabel(state.endReason)}`),
    );
    await expect(dialog.getByRole('status')).toHaveText('Result saved on this device.');
    await expect(dialog.getByRole('button', { name: 'Play again' })).toBeFocused();
    await expect(page.getByRole('button', { name: 'Pause' })).toHaveCount(0);

    expect(await readStorage(page, LAST_RESULT_KEY)).toMatchObject({
      playerId: TEST_PLAYER_ID,
      playerName: 'Test Captain',
      score: state.score,
      durationMs: Math.round(state.elapsedSeconds * 1000),
      endReason: state.endReason,
      config: { sessionSeconds: 60, spawnIntervalSeconds: 10 },
    });
  });

  test('the last result survives a refresh, and Play again starts from there', async ({
    page,
    openApp,
  }) => {
    await shortMatches(page);
    await openMatch(page, openApp);
    await playToTheEnd(page);
    const stored = await readStorage(page, LAST_RESULT_KEY);
    const ended = await snapshot(page);
    const score = String(ended.score);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Battle complete' })).toBeVisible();
    await expect(page.getByTestId('result-score')).toHaveText(score);
    await expect(page.getByTestId('result-summary')).toContainText(played(ended.elapsedSeconds));
    // A refresh never records anything again.
    expect(await readStorage(page, LAST_RESULT_KEY)).toEqual(stored);

    await page.getByRole('button', { name: 'Play again' }).click();
    await waitForArena(page);
    await expect(page).toHaveURL(/\/play\?/);
    expect(await snapshot(page)).toMatchObject({ phase: 'running', stepCount: 0 });
  });

  test('Play again uses the Options changed during the match', async ({ page, openApp }) => {
    await shortMatches(page);
    await openMatch(page, openApp);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Options' }).click();
    await page.getByRole('button', { name: 'Increase game session time' }).click();
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'Resume' }).click();
    await playToTheEnd(page);
    await expect(page.getByRole('dialog', { name: 'Battle complete' })).toBeVisible();

    await page.getByRole('button', { name: 'Play again' }).click();
    await expect(page).toHaveURL(/\/play\?/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect((await snapshot(page)).timeLeftSeconds).toBe(70);
    expect(await readStorage(page, OPTIONS_KEY)).toMatchObject({ sessionSeconds: 70 });
  });

  test('without a stored result, /result opens the menu', async ({ page, openApp }) => {
    await openApp('/result');
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });
});
