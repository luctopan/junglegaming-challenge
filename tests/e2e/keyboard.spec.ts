import { expect, test } from './fixtures/test';
import { advance, dispatchKey, openMatch, snapshot, startGame } from './helpers/game';

/**
 * Game keys are captured only while the match runs: menus, dialogs and page
 * scrolling keep their normal keyboard behaviour everywhere else.
 */
test.describe('keyboard capture', () => {
  test('Space and arrows are prevented only while the match is running', async ({
    page,
    openApp,
  }) => {
    await openApp('/?test=1&clock=manual');
    expect(await dispatchKey(page, 'keydown', { code: 'Space', key: ' ' })).toBe(false);
    expect(await dispatchKey(page, 'keydown', { code: 'ArrowDown', key: 'ArrowDown' })).toBe(false);

    await startGame(page);
    await expect(page.getByTestId('hud')).toBeVisible({ timeout: 15_000 });
    expect(await dispatchKey(page, 'keydown', { code: 'Space', key: ' ' })).toBe(true);
    expect(await dispatchKey(page, 'keydown', { code: 'ArrowUp', key: 'ArrowUp' })).toBe(true);
    // Not a game key: left to the browser.
    expect(await dispatchKey(page, 'keydown', { code: 'Tab', key: 'Tab' })).toBe(false);
    await dispatchKey(page, 'keyup', { code: 'Space', key: ' ' });
    await dispatchKey(page, 'keyup', { code: 'ArrowUp', key: 'ArrowUp' });

    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
    expect(await dispatchKey(page, 'keydown', { code: 'Space', key: ' ' })).toBe(false);
    expect(await dispatchKey(page, 'keydown', { code: 'KeyW', key: 'w' })).toBe(false);
  });

  test('auto-repeat never acts: a key held through a pause does nothing until pressed again', async ({
    page,
    openApp,
  }) => {
    await openMatch(page, openApp);
    await page.keyboard.down('KeyW');
    await advance(page, 300);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
    expect((await snapshot(page)).inputIdle).toBe(true);

    await page.getByRole('button', { name: 'Resume' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await advance(page, 3000); // coast to a stop
    const coasted = await snapshot(page);
    // W is still physically down: the OS keeps sending auto-repeat keydowns.
    for (let i = 0; i < 5; i++) {
      expect(await dispatchKey(page, 'keydown', { code: 'KeyW', key: 'w', repeat: true })).toBe(
        true,
      );
      await advance(page, 100);
    }
    const repeated = await snapshot(page);
    expect(repeated.player.y).toBeCloseTo(coasted.player.y, 5);
    expect(repeated.inputIdle).toBe(true);

    // A fresh press acts again.
    await page.keyboard.up('KeyW');
    await page.keyboard.down('KeyW');
    await advance(page, 500);
    await page.keyboard.up('KeyW');
    expect((await snapshot(page)).player.y).toBeLessThan(coasted.player.y);
  });

  test('holding Escape pauses once; only a fresh Escape resumes', async ({ page, openApp }) => {
    await openMatch(page, openApp);
    await page.keyboard.down('Escape');
    const dialog = page.getByRole('dialog', { name: 'Paused' });
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 3; i++) {
      await dispatchKey(page, 'keydown', { code: 'Escape', key: 'Escape', repeat: true });
    }
    await expect(dialog).toBeVisible();
    expect((await snapshot(page)).phase).toBe('paused');

    await page.keyboard.up('Escape');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect((await snapshot(page)).phase).toBe('running');
  });

  test('releasing Space after pausing cannot click the focused Resume button', async ({
    page,
    openApp,
  }) => {
    await openMatch(page, openApp);
    await page.keyboard.down('Space');
    await advance(page, 50);
    await page.keyboard.press('KeyP');
    await expect(page.getByRole('button', { name: 'Resume' })).toBeFocused();
    await page.keyboard.up('Space');
    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
    expect((await snapshot(page)).phase).toBe('paused');
  });
});
