import { expect, PROFILE_KEY, readStorage, seedStorage, test } from './fixtures/test';
import { waitForArena } from './helpers/game';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test.describe('captain name', () => {
  test.use({ captainName: null });

  test('first Play asks for a name, with focus kept inside the dialog', async ({
    page,
    openApp,
  }) => {
    await openApp('/?test=1');
    const play = page.getByRole('button', { name: 'Play', exact: true });
    await play.click();
    const dialog = page.getByRole('dialog', { name: 'Choose your captain name' });
    await expect(dialog).toBeVisible();
    const name = dialog.getByRole('textbox', { name: 'Captain name' });
    await expect(name).toBeFocused();

    // Tab cycles through the dialog's controls only.
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Set sail' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(name).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();

    // Escape closes it, returns focus to Play and starts nothing.
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(play).toBeFocused();
    await expect(page).toHaveURL(/\/\?test=1$/);
    expect(await readStorage(page, PROFILE_KEY)).toBeNull();
  });

  test('invalid names show an accessible error; a valid one starts the match', async ({
    page,
    openApp,
  }) => {
    await openApp('/?test=1');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Choose your captain name' });
    const name = dialog.getByRole('textbox', { name: 'Captain name' });

    await name.fill(' J ');
    await name.press('Enter');
    await expect(dialog.getByRole('alert')).toHaveText('Enter at least 2 characters.');
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await expect(name).toHaveAccessibleDescription(/Enter at least 2 characters/);

    await name.fill('Jack_Sparrow!');
    await expect(dialog.getByRole('alert')).toContainText('Use only letters, numbers');
    await name.fill('x'.repeat(21));
    await expect(dialog.getByRole('alert')).toHaveText('Use at most 20 characters.');

    await name.fill('  Captain Jack ');
    await dialog.getByRole('button', { name: 'Set sail' }).click();
    await waitForArena(page);
    await expect(page).toHaveURL(/\/play\?test=1$/);
    const profile = (await readStorage(page, PROFILE_KEY)) as { playerId: string; name: string };
    expect(profile.name).toBe('Captain Jack');
    expect(profile.playerId).toMatch(UUID_V4);
  });

  test('renaming from Options keeps the player id', async ({ page, openApp }) => {
    await openApp('/');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.getByRole('textbox', { name: 'Captain name' }).fill('Captain Jack');
    await page.getByRole('button', { name: 'Set sail' }).click();
    await waitForArena(page);
    const first = (await readStorage(page, PROFILE_KEY)) as { playerId: string };

    await page.goto('/options');
    await expect(page.getByText('Captain: Captain Jack')).toBeVisible();
    const rename = page.getByRole('button', { name: 'Rename' });
    await rename.click();
    const dialog = page.getByRole('dialog', { name: 'Rename your captain' });
    const name = dialog.getByRole('textbox', { name: 'Captain name' });
    await expect(name).toHaveValue('Captain Jack');
    await name.fill("Anne O'Malley");
    await name.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(rename).toBeFocused();
    await expect(page.getByText("Captain: Anne O'Malley")).toBeVisible();
    expect(await readStorage(page, PROFILE_KEY)).toEqual({
      playerId: first.playerId,
      name: "Anne O'Malley",
    });

    await page.reload();
    await expect(page.getByText("Captain: Anne O'Malley")).toBeVisible();
  });

  test('a corrupted profile asks for the name again', async ({ page, openApp }) => {
    await seedStorage(page, PROFILE_KEY, JSON.stringify({ playerId: 'not-a-uuid', name: 'X' }));
    await openApp('/');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Choose your captain name' })).toBeVisible();
  });
});

test.describe('captain name, returning player', () => {
  test('Play starts directly when a captain exists', async ({ page, openApp }) => {
    await openApp('/?test=1');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await waitForArena(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
