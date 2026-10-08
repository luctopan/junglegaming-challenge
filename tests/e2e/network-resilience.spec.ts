import type { Page } from '@playwright/test';
import {
  expect,
  MOCK_DB_KEY,
  NETWORK_FAILURE_LOG,
  PENDING_KEY,
  readStorage,
  seedMockRecords,
  test,
  testMatch,
} from './fixtures/test';
import { openMatch, playToTheEnd, snapshot, useShortMatches, waitForArena } from './helpers/game';

/**
 * Network scenarios of the MSW backend: lost responses, timeouts, late
 * answers, and failures that must never block the game. Selected through
 * `?scenario=` and the dev panel.
 */
const status = (page: Page) => page.getByTestId('submission-status');
const rows = (page: Page) => page.getByRole('tabpanel').getByRole('row');

async function storedCount(page: Page, key: string): Promise<number> {
  const value = await readStorage(page, key);
  return Array.isArray(value) ? value.length : 0;
}

test.describe('network resilience', () => {
  test('a write committed before a timeout is resent without a duplicate', async ({
    page,
    openApp,
  }) => {
    const puts: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'PUT' && request.url().includes('/api/matches/')) {
        puts.push(request.postData() ?? '');
      }
    });
    await useShortMatches(page);
    await openMatch(page, openApp, '&scenario=write-timeout-after-commit&apiTimeout=400');
    await playToTheEnd(page);
    await expect(status(page)).toHaveText('Saved to the ranking and your match history.', {
      timeout: 10_000,
    });
    // The first answer was lost, the resend found the same match: one record.
    expect(puts.length).toBeGreaterThanOrEqual(2);
    expect(new Set(puts).size).toBe(1);
    expect(await storedCount(page, MOCK_DB_KEY)).toBe(1);

    await page.getByRole('button', { name: 'Main menu' }).click();
    await page.getByRole('button', { name: 'Match history' }).click();
    await expect(rows(page)).toHaveCount(2);
  });

  test('reads that time out end in the error state', async ({
    page,
    openApp,
    allowConsoleError,
  }) => {
    allowConsoleError(NETWORK_FAILURE_LOG);
    await openApp('/records/ranking?test=1&scenario=timeout&apiTimeout=300');
    await expect(page.getByRole('status').filter({ hasText: 'Loading the ranking' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Could not load the ranking', {
      timeout: 10_000,
    });
  });

  test('a late answer never replaces the page asked for last', async ({ page, openApp }) => {
    await openApp('/records/ranking?test=1&scenario=out-of-order');
    await expect(rows(page).nth(1)).toContainText('Captain Flint', { timeout: 5_000 });
    const next = page.getByRole('button', { name: 'Next ranking page' });
    // Page 2 and page 3 requested back to back; one of them is answered late.
    await next.click();
    await next.click();
    await expect(page.getByText('Page 3 of 3', { exact: true })).toBeVisible();
    await expect(rows(page).nth(1)).toContainText('11', { timeout: 5_000 });
    // Well past the late latency, page 3 is still on screen.
    await page.waitForTimeout(2_000);
    await expect(page.getByText('Page 3 of 3', { exact: true })).toBeVisible();
    await expect(rows(page).nth(1)).toContainText('11');
    await expect(rows(page)).toHaveCount(4);
  });

  test('API failures never block the game', async ({ page, openApp, allowConsoleError }) => {
    allowConsoleError(NETWORK_FAILURE_LOG);
    await useShortMatches(page);
    await openMatch(page, openApp, '&scenario=network-error');
    await playToTheEnd(page);
    await expect(status(page)).toHaveText('Not saved yet: it will be sent again automatically.', {
      timeout: 10_000,
    });
    expect(await storedCount(page, PENDING_KEY)).toBe(1);
    await page.getByRole('button', { name: 'Play again' }).click();
    await waitForArena(page);
    await expect.poll(async () => (await snapshot(page)).phase).toBe('running');
  });

  test('dev panel: scenario selection and reset', async ({ page, openApp }) => {
    await seedMockRecords(page, [testMatch()]);
    await openApp('/?dev=1');
    const panel = page.getByRole('dialog', { name: 'Mock backend' });
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId('mock-status')).toHaveText(/1 saved match · 0 pending/);

    await panel.getByRole('combobox', { name: 'Scenario' }).selectOption('empty');
    await expect(panel.getByText('No fixture records')).toBeVisible();
    await panel.getByRole('button', { name: 'Reset' }).click();
    await expect(panel.getByTestId('mock-status')).toHaveText(/0 saved matches · 0 pending/);
    await expect(panel.getByRole('combobox', { name: 'Scenario' })).toHaveValue('success');
    await panel.getByRole('button', { name: 'Close' }).click();

    // The discreet footer link opens it again.
    await page.getByRole('button', { name: 'Mock backend' }).click();
    await panel.getByRole('combobox', { name: 'Scenario' }).selectOption('empty');
    await panel.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: 'Ranking', exact: true }).click();
    await expect(page.getByText('No battles recorded with these settings yet')).toBeVisible();
    // The scenario holds for the tab (sessionStorage) across a reload.
    await page.reload();
    await expect(page.getByText('No battles recorded with these settings yet')).toBeVisible();
  });
});
