import type { Page } from '@playwright/test';
import {
  expect,
  LAST_RESULT_KEY,
  MOCK_DB_KEY,
  NETWORK_FAILURE_LOG,
  PENDING_KEY,
  readStorage,
  test,
} from './fixtures/test';
import { openMatch, playToTheEnd, snapshot, useShortMatches, waitForArena } from './helpers/game';

/**
 * Registering a finished match: idempotent PUT, persisted pending queue,
 * Result status, and both Captain's Log tabs refreshed after success.
 */
const status = (page: Page) => page.getByTestId('submission-status');
const rows = (page: Page) => page.getByRole('tabpanel').getByRole('row');

async function storedList(page: Page, key: string): Promise<unknown[]> {
  const value = await readStorage(page, key);
  return Array.isArray(value) ? (value as unknown[]) : [];
}

test.describe('match submission', () => {
  test('a saved match shows up in the ranking and the history', async ({ page, openApp }) => {
    await useShortMatches(page);
    await openMatch(page, openApp);
    await playToTheEnd(page);
    const { score } = await snapshot(page);
    await expect(status(page)).toHaveText('Saved to the ranking and your match history.');
    expect(await storedList(page, PENDING_KEY)).toEqual([]);

    await page.getByRole('button', { name: 'Main menu' }).click();
    await page.getByRole('button', { name: 'Ranking', exact: true }).click();
    // 60 s / 10 s has no fixture captains: the player is alone at the top.
    const mine = rows(page).filter({ hasText: '(you)' });
    await expect(mine).toHaveCount(1);
    await expect(mine).toContainText('01');
    await expect(mine).toContainText(String(score));

    await page.getByRole('tab', { name: 'Match history' }).click();
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).nth(1)).toContainText(String(score));
  });

  test('a pending match survives a refresh and is sent on the next start', async ({
    page,
    openApp,
    allowConsoleError,
  }) => {
    allowConsoleError(NETWORK_FAILURE_LOG);
    await useShortMatches(page);
    await openMatch(page, openApp, '&scenario=http-500');
    await playToTheEnd(page);
    await expect(status(page)).toHaveText('Not saved yet: it will be sent again automatically.', {
      timeout: 10_000,
    });
    const pending = await storedList(page, PENDING_KEY);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toEqual(await readStorage(page, LAST_RESULT_KEY));

    // A new match can start while the record is pending.
    await page.getByRole('button', { name: 'Play again' }).click();
    await waitForArena(page);
    await expect.poll(async () => (await snapshot(page)).phase).toBe('running');

    // The backend is back: the app start flushes the queue.
    await openApp('/records/history?test=1&scenario=success');
    await expect(rows(page)).toHaveCount(2);
    await expect.poll(() => storedList(page, PENDING_KEY)).toEqual([]);
    expect(await storedList(page, MOCK_DB_KEY)).toHaveLength(1);
  });

  test('unavailable at match end, saved with Retry after recovery', async ({
    page,
    openApp,
    allowConsoleError,
  }) => {
    allowConsoleError(NETWORK_FAILURE_LOG);
    await useShortMatches(page);
    await openMatch(page, openApp, '&scenario=unavailable-then-recover');
    await playToTheEnd(page);
    // Three attempts (the request and two automatic retries) all get 503.
    await expect(status(page)).toHaveText('Not saved yet: it will be sent again automatically.', {
      timeout: 10_000,
    });
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(status(page)).toHaveText('Saved to the ranking and your match history.');
    expect(await storedList(page, PENDING_KEY)).toEqual([]);
    expect(await storedList(page, MOCK_DB_KEY)).toHaveLength(1);
  });

  test('a rejected match reports the failure and offers Retry', async ({
    page,
    openApp,
    allowConsoleError,
  }) => {
    allowConsoleError(NETWORK_FAILURE_LOG);
    await useShortMatches(page);
    await openMatch(page, openApp, '&scenario=http-400');
    await playToTheEnd(page);
    await expect(status(page)).toHaveText('Could not save your battle.');
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    // Never blocks the next match.
    await expect(page.getByRole('button', { name: 'Play again' })).toBeEnabled();
    expect(await storedList(page, PENDING_KEY)).toHaveLength(1);
  });
});
