import type { Page } from '@playwright/test';
import {
  expect,
  NETWORK_FAILURE_LOG,
  seedMockRecords,
  seedStorage,
  test,
  testMatch,
} from './fixtures/test';

/**
 * Captain's Log over the real API layer (Axios + TanStack Query) and the MSW
 * backend: pagination, ordering, YOU badge, config selector, and the loading,
 * empty, error and cached states driven by network scenarios.
 */
const rows = (page: Page) => page.getByRole('tabpanel').getByRole('row');
const rankingRequests = (page: Page): string[] => {
  const urls: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/ranking?')) urls.push(request.url());
  });
  return urls;
};

test.describe("captain's log", () => {
  test('tabs follow the ARIA pattern and the URL', async ({ page, openApp }) => {
    await openApp('/?test=1');
    await page.getByRole('button', { name: 'Ranking', exact: true }).click();
    await expect(page).toHaveURL(/\/records\/ranking\?test=1$/);
    const ranking = page.getByRole('tab', { name: 'Ranking' });
    const history = page.getByRole('tab', { name: 'Match history' });
    await expect(ranking).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name: 'Ranking' })).toBeVisible();

    await ranking.focus();
    await page.keyboard.press('ArrowRight');
    await expect(history).toBeFocused();
    await expect(history).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/\/records\/history\?test=1$/);
    await expect(page.getByRole('tabpanel', { name: 'Match history' })).toBeVisible();
    await page.keyboard.press('Home');
    await expect(ranking).toBeFocused();
    await page.keyboard.press('End');
    await expect(history).toBeFocused();

    // The tab survives a refresh; the tab switch did not add history entries.
    await page.reload();
    await expect(history).toHaveAttribute('aria-selected', 'true');
    await page.goBack();
    await expect(page).toHaveURL(/\/\?test=1$/);
  });

  test('ranking is paginated and ordered by score', async ({ page, openApp }) => {
    await openApp('/records/ranking?test=1');
    await expect(rows(page).nth(1)).toContainText('01');
    await expect(rows(page).nth(1)).toContainText('Captain Flint');
    await expect(rows(page)).toHaveCount(6); // header + 5
    await expect(page.getByText('Page 1 of 3', { exact: true })).toBeVisible();
    const previous = page.getByRole('button', { name: 'Previous ranking page' });
    const next = page.getByRole('button', { name: 'Next ranking page' });
    await expect(previous).toBeDisabled();

    await next.click();
    await expect(page.getByText('Page 2 of 3', { exact: true })).toBeVisible();
    await expect(rows(page).nth(1)).toContainText('06');
    await next.click();
    await expect(page.getByText('Page 3 of 3', { exact: true })).toBeVisible();
    await expect(next).toBeDisabled();
    await expect(rows(page)).toHaveCount(4); // header + 3
  });

  test('multi-page scenario: long pagination', async ({ page, openApp }) => {
    await openApp('/records/ranking?test=1&scenario=multi-page');
    await expect(page.getByText('Page 1 of 15', { exact: true })).toBeVisible();
    await expect(rows(page).nth(1)).toContainText('90');
  });

  test('the player is marked YOU by id, and their history is listed', async ({ page, openApp }) => {
    await seedMockRecords(page, [testMatch()]);
    await openApp('/records/ranking?test=1');
    const mine = rows(page).filter({ hasText: 'Test Captain' });
    await expect(mine).toHaveCount(1);
    await expect(mine).toContainText('03');
    await expect(mine).toContainText('(you)');
    await expect(rows(page).filter({ hasText: '(you)' })).toHaveCount(1);

    await page.getByRole('tab', { name: 'Match history' }).click();
    await expect(page.getByText('Test Captain · Your recent battles')).toBeVisible();
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).nth(1)).toContainText('08 SEP');
    await expect(rows(page).nth(1)).toContainText('02:00');
    await expect(rows(page).nth(1)).toContainText('Time up');
  });

  test('the ranking defaults to the current Options and can show other configs', async ({
    page,
    openApp,
  }) => {
    await seedStorage(
      page,
      'pirate.options.v1',
      JSON.stringify({ sessionSeconds: 60, spawnIntervalSeconds: 1 }),
    );
    await openApp('/records/ranking?test=1');
    const settings = page.getByRole('combobox', { name: 'Battle settings of the ranking' });
    await expect(settings).toHaveValue('60s-1s');
    await expect(rows(page).nth(1)).toContainText('22');
    await expect(page.getByText('Page 1 of 1', { exact: true })).toBeVisible();

    await settings.selectOption('180s-5s');
    await expect(rows(page).nth(1)).toContainText('41');
    await expect(settings.locator('option')).toHaveText([
      /^60 second battles/,
      /^120 second battles/,
      /^180 second battles/,
    ]);
  });

  test('loading state, then data (slow scenario)', async ({ page, openApp }) => {
    await openApp('/records/ranking?test=1&scenario=slow');
    await expect(page.getByRole('status').filter({ hasText: 'Loading the ranking' })).toBeVisible();
    await expect(rows(page).nth(1)).toContainText('Captain Flint', { timeout: 10_000 });
  });

  test('empty states', async ({ page, openApp }) => {
    await openApp('/records/ranking?test=1&scenario=empty');
    await expect(page.getByText('No battles recorded with these settings yet')).toBeVisible();
    await page.getByRole('tab', { name: 'Match history' }).click();
    await expect(page.getByText('No battles yet')).toBeVisible();
  });

  test('read failures show an error with Retry, per list', async ({
    page,
    openApp,
    allowConsoleError,
  }) => {
    allowConsoleError(NETWORK_FAILURE_LOG);
    await openApp('/records/ranking?test=1&scenario=ranking-fail');
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Could not load the ranking', { timeout: 10_000 });
    await alert.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Loading the ranking' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Could not load the ranking', {
      timeout: 10_000,
    });
    // The history is a separate endpoint: still available.
    await page.getByRole('tab', { name: 'Match history' }).click();
    await expect(page.getByText('No battles yet')).toBeVisible();

    await openApp('/records/history?test=1&scenario=history-fail');
    await expect(page.getByRole('alert')).toContainText('Could not load your match history', {
      timeout: 10_000,
    });
  });

  test('cached rows stay on screen and refresh in the background on re-show', async ({
    page,
    openApp,
  }) => {
    const requests = rankingRequests(page);
    await openApp('/records/ranking?test=1');
    await expect(rows(page).nth(1)).toContainText('Captain Flint');
    const before = requests.length;

    await page.getByRole('tab', { name: 'Match history' }).click();
    await page.getByRole('tab', { name: 'Ranking' }).click();
    // Shown from the cache at once (no loading state), refetched behind it.
    await expect(rows(page).nth(1)).toContainText('Captain Flint');
    await expect(page.getByText('Loading the ranking')).toHaveCount(0);
    await expect.poll(() => requests.length).toBeGreaterThan(before);
  });
});
