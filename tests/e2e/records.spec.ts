import type { Page } from '@playwright/test';
import { expect, seedStorage, test, TEST_PLAYER_ID } from './fixtures/test';

/**
 * Captain's Log on the temporary Phase 4 records source (in-memory fixtures;
 * Phase 5 moves these checks onto the API layer and MSW scenarios).
 */
const LAST_RESULT = {
  matchId: '7d1f3c2a-9b8e-4f6d-a5c4-3b2a1f0e9d8c',
  playerId: TEST_PLAYER_ID,
  playerName: 'Test Captain',
  playedAt: '2026-09-08T19:36:00.000Z',
  score: 24,
  durationMs: 120_000,
  endReason: 'time_up',
  config: { sessionSeconds: 120, spawnIntervalSeconds: 3 },
};

const seedLastResult = (page: Page) =>
  seedStorage(page, 'pirate.lastResult.v1', JSON.stringify(LAST_RESULT));

const rows = (page: Page) => page.getByRole('tabpanel').getByRole('row');

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

  test('the player is marked YOU by id, and their history is listed', async ({ page, openApp }) => {
    await seedLastResult(page);
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

  test('loading, error with retry, and empty states', async ({ page, openApp }) => {
    await openApp('/records/ranking?test=1&records=loading');
    await expect(page.getByRole('status').filter({ hasText: 'Loading the ranking' })).toBeVisible();

    await openApp('/records/ranking?test=1&records=error');
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Could not load the ranking');
    await alert.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByRole('alert')).toContainText('Could not load the ranking');

    await openApp('/records/ranking?test=1&records=empty');
    await expect(page.getByText('No battles recorded with these settings yet')).toBeVisible();
    await openApp('/records/history?test=1');
    await expect(page.getByText('No battles yet')).toBeVisible();
  });

  test('state overrides are ignored outside test mode', async ({ page, openApp }) => {
    await openApp('/records/ranking?records=error');
    await expect(rows(page).nth(1)).toContainText('Captain Flint');
  });
});
