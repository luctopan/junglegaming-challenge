import type { Page } from '@playwright/test';
import { expect, OPTIONS_KEY, readStorage, seedStorage, test } from './fixtures/test';
import { openMatch, snapshot } from './helpers/game';

const sessionTime = (page: Page) => page.getByRole('spinbutton', { name: 'Game session time' });
const spawnTime = (page: Page) => page.getByRole('spinbutton', { name: 'Enemy spawn time' });

async function openOptions(page: Page, openApp: (path?: string) => Promise<void>, path = '/') {
  await openApp(path);
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Options' })).toBeVisible();
}

test.describe('options', () => {
  test('menu → Options → Main menu, with the defaults shown', async ({ page, openApp }) => {
    await openOptions(page, openApp);
    await expect(page).toHaveURL(/\/options$/);
    await expect(sessionTime(page)).toHaveAttribute('aria-valuenow', '120');
    await expect(sessionTime(page)).toHaveAttribute('aria-valuemin', '60');
    await expect(sessionTime(page)).toHaveAttribute('aria-valuemax', '180');
    await expect(sessionTime(page)).toHaveAttribute('aria-valuetext', '120 seconds');
    await expect(spawnTime(page)).toHaveAttribute('aria-valuenow', '3');

    await page.getByRole('button', { name: 'Main menu' }).click();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  });

  test('spinbuttons follow the keyboard and the −/+ buttons, within the limits', async ({
    page,
    openApp,
  }) => {
    await openOptions(page, openApp);
    const session = sessionTime(page);
    await session.focus();
    await page.keyboard.press('ArrowUp');
    await expect(session).toHaveAttribute('aria-valuenow', '130');
    await page.keyboard.press('PageDown');
    await expect(session).toHaveAttribute('aria-valuenow', '80');
    await page.keyboard.press('End');
    await expect(session).toHaveAttribute('aria-valuenow', '180');
    await expect(page.getByRole('button', { name: 'Increase game session time' })).toBeDisabled();
    await page.keyboard.press('Home');
    await expect(session).toHaveAttribute('aria-valuenow', '60');
    await expect(page.getByRole('button', { name: 'Decrease game session time' })).toBeDisabled();

    const spawn = spawnTime(page);
    await page.getByRole('button', { name: 'Increase enemy spawn time' }).click();
    await expect(spawn).toHaveAttribute('aria-valuenow', '3.5');
    await page.getByRole('button', { name: 'Decrease enemy spawn time' }).click();
    await page.getByRole('button', { name: 'Decrease enemy spawn time' }).click();
    await expect(spawn).toHaveAttribute('aria-valuenow', '2.5');
    await expect(page.getByRole('status').filter({ hasText: 'Options saved.' })).toBeVisible();
  });

  test('an invalid typed value shows an accessible error and is never saved', async ({
    page,
    openApp,
  }) => {
    await openOptions(page, openApp);
    const session = sessionTime(page);
    await session.fill('75');
    await session.press('Enter');
    const error = page.getByRole('alert').filter({ hasText: 'Game session time' });
    await expect(error).toContainText('between 60 and 180 in steps of 10');
    await expect(session).toHaveAttribute('aria-invalid', 'true');
    await expect(session).toHaveAccessibleDescription(/between 60 and 180/);
    await expect(session).toHaveAttribute('aria-valuenow', '120');
    expect(await readStorage(page, OPTIONS_KEY)).toBeNull();

    // Escape restores the saved value; a valid entry is saved.
    await session.press('Escape');
    await expect(session).toHaveValue('120');
    await expect(session).toHaveAttribute('aria-invalid', 'false');
    await session.fill('0');
    await session.press('Tab');
    await expect(session).toHaveAttribute('aria-invalid', 'true');
    await session.fill('150');
    await session.press('Enter');
    await expect(session).toHaveAttribute('aria-valuenow', '150');
    await expect(session).toHaveAttribute('aria-invalid', 'false');

    await spawnTime(page).fill('0');
    await spawnTime(page).press('Enter');
    await expect(page.getByRole('alert').filter({ hasText: 'Enemy spawn time' })).toContainText(
      'between 1 and 10',
    );
    expect(await readStorage(page, OPTIONS_KEY)).toEqual({
      sessionSeconds: 150,
      spawnIntervalSeconds: 3,
    });
  });

  test('saved options survive a refresh', async ({ page, openApp }) => {
    await openOptions(page, openApp);
    await sessionTime(page).fill('90');
    await sessionTime(page).press('Enter');
    await spawnTime(page).fill('1.5');
    await spawnTime(page).press('Enter');
    await page.reload();
    await expect(sessionTime(page)).toHaveAttribute('aria-valuenow', '90');
    await expect(spawnTime(page)).toHaveAttribute('aria-valuenow', '1.5');
  });

  test('corrupted saved options fall back to the defaults with a message', async ({
    page,
    openApp,
  }) => {
    await seedStorage(page, OPTIONS_KEY, JSON.stringify({ sessionSeconds: 9999 }));
    await openOptions(page, openApp);
    await expect(page.getByRole('alert').filter({ hasText: 'could not be read' })).toBeVisible();
    await expect(sessionTime(page)).toHaveAttribute('aria-valuenow', '120');
    await expect(spawnTime(page)).toHaveAttribute('aria-valuenow', '3');

    await sessionTime(page).press('ArrowDown');
    await expect(page.getByRole('alert').filter({ hasText: 'could not be read' })).toHaveCount(0);
    expect(await readStorage(page, OPTIONS_KEY)).toEqual({
      sessionSeconds: 110,
      spawnIntervalSeconds: 3,
    });
    await page.reload();
    await expect(sessionTime(page)).toHaveAttribute('aria-valuenow', '110');
  });

  test('unreadable saved data (not JSON) is handled the same way', async ({ page, openApp }) => {
    await seedStorage(page, OPTIONS_KEY, '{oops');
    await openOptions(page, openApp);
    await expect(page.getByRole('alert').filter({ hasText: 'could not be read' })).toBeVisible();
    await expect(sessionTime(page)).toHaveAttribute('aria-valuenow', '120');
  });

  test('the next match uses the saved options', async ({ page, openApp }) => {
    await seedStorage(
      page,
      OPTIONS_KEY,
      JSON.stringify({ sessionSeconds: 60, spawnIntervalSeconds: 1 }),
    );
    await openMatch(page, openApp);
    expect((await snapshot(page)).timeLeftSeconds).toBe(60);
  });
});
