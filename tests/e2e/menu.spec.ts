import { expect, test } from './fixtures/test';

test.describe('main menu', () => {
  test('shows the actions, the records entries and the controls', async ({ page, openApp }) => {
    await openApp('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Pirate Battle' })).toBeVisible();
    for (const name of ['Play', 'Options', 'Ranking', 'Match history']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('img', { name: 'Jungle Gaming' })).toBeVisible();
  });

  test('controls are always listed, with the full table in a dialog', async ({
    page,
    openApp,
    isMobile,
  }) => {
    await openApp('/');
    const summary = page.locator('p').filter({ hasText: isMobile ? /^Touch:/ : /^Keys:/ });
    await expect(summary).toBeVisible();
    if (!isMobile) await expect(summary).toContainText('Space');

    const open = page.getByRole('button', { name: 'Controls' });
    await open.click();
    const dialog = page.getByRole('dialog', { name: 'Controls' });
    const table = dialog.getByRole('table', { name: 'Keyboard and touch controls' });
    await expect(table.getByRole('row')).toHaveCount(8);
    await expect(table.getByRole('row', { name: /Fire left broadside/ })).toContainText('Q');
    await expect(table.getByRole('row', { name: /Pause/ })).toContainText('Esc');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(open).toBeFocused();
  });

  test('every action is reachable with the keyboard alone', async ({ page, openApp }) => {
    await openApp('/');
    const reached: string[] = [];
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      reached.push(
        await page.evaluate(() => {
          const active = (globalThis as unknown as { document: { activeElement: unknown } })
            .document.activeElement as {
            getAttribute(n: string): string | null;
            textContent: string;
          };
          return active.getAttribute('aria-label') ?? active.textContent;
        }),
      );
    }
    expect(reached).toEqual(
      expect.arrayContaining([
        'Play',
        'Options',
        'Ranking',
        'Match history',
        'Controls',
        'Mute sound',
      ]),
    );

    await page.getByRole('button', { name: 'Options', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Options' })).toBeVisible();
  });
});
