import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/test';
import { advance, openMatch, snapshot } from './helpers/game';

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('element is not rendered');
  return box;
}

function expectInside(box: Box, viewport: { width: number; height: number }, what: string): void {
  expect(box.x, `${what} left`).toBeGreaterThanOrEqual(0);
  expect(box.y, `${what} top`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `${what} right`).toBeLessThanOrEqual(viewport.width + 0.5);
  expect(box.y + box.height, `${what} bottom`).toBeLessThanOrEqual(viewport.height + 0.5);
}

const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

function viewportOf(page: Page): { width: number; height: number } {
  const size = page.viewportSize();
  if (size === null) throw new Error('no viewport');
  return size;
}

test.describe('layout: nothing clipped (1280×720 and Pixel 7 landscape)', () => {
  test('arena, HUD and controls fit the screen without overlapping', async ({
    page,
    openApp,
    hasTouch,
  }) => {
    await openMatch(page, openApp);
    const viewport = viewportOf(page);
    const canvas = await boxOf(page.getByTestId('arena').locator('canvas'));
    expectInside(canvas, viewport, 'arena canvas');

    const hud = [
      await boxOf(page.getByTestId('hud').locator('> div').first()),
      await boxOf(page.getByTestId('hud-score').locator('..')),
      await boxOf(page.getByTestId('hud-time').locator('..')),
      await boxOf(page.getByRole('button', { name: 'Pause' })),
      await boxOf(page.getByRole('button', { name: 'Mute sound' })),
    ];
    for (const [index, box] of hud.entries()) expectInside(box, viewport, `HUD item ${index}`);
    for (const [i, a] of hud.entries()) {
      for (const [j, b] of hud.slice(i + 1).entries()) {
        expect(overlaps(a, b), `HUD items ${i} and ${i + 1 + j}`).toBe(false);
      }
    }

    const controls = page.locator('[data-game-action]');
    if (hasTouch) {
      await expect(controls).toHaveCount(6);
      for (const control of await controls.all()) {
        const box = await boxOf(control);
        expectInside(box, viewport, 'touch control');
        expect(box.width, 'touch target size').toBeGreaterThanOrEqual(44);
        for (const item of hud) expect(overlaps(box, item)).toBe(false);
      }
    } else {
      // Keyboard devices get no on-screen controls (they would cover the arena).
      await expect(controls.first()).toBeHidden();
    }
  });

  test('menus fit without page scrolling', async ({ page, openApp }) => {
    for (const path of ['/', '/options', '/records/ranking?test=1']) {
      await openApp(path);
      const panel = page.locator('section').first();
      expectInside(await boxOf(panel), viewportOf(page), `panel at ${path}`);
    }
  });
});

test.describe('portrait on touch devices', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'orientation rules apply to touch devices');

  test('portrait shows the rotate overlay and pauses; landscape needs Resume', async ({
    page,
    openApp,
  }) => {
    await openMatch(page, openApp);
    const landscape = viewportOf(page);
    await advance(page, 500);

    await page.setViewportSize({ width: landscape.height, height: landscape.width });
    const overlay = page.getByRole('alert').filter({ hasText: 'Rotate your device' });
    await expect(overlay).toBeVisible();
    await expect.poll(async () => (await snapshot(page)).pauseReason).toBe('portrait');
    const paused = await snapshot(page);
    await advance(page, 2000);
    expect((await snapshot(page)).stepCount).toBe(paused.stepCount);

    await page.setViewportSize(landscape);
    await expect(overlay).toHaveCount(0);
    const dialog = page.getByRole('dialog', { name: 'Paused' });
    await expect(dialog).toContainText('landscape');
    await dialog.getByRole('button', { name: 'Resume' }).click();
    await advance(page, 500);
    expect((await snapshot(page)).stepCount).toBeGreaterThan(paused.stepCount);
  });

  test('menus stay usable in portrait', async ({ page, openApp }) => {
    const landscape = viewportOf(page);
    await page.setViewportSize({ width: landscape.height, height: landscape.width });
    await openApp('/');
    await expect(page.getByRole('alert').filter({ hasText: 'Rotate' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Options', exact: true }).click();
    await page.getByRole('button', { name: 'Increase game session time' }).click();
    await expect(page.getByRole('spinbutton', { name: 'Game session time' })).toHaveAttribute(
      'aria-valuenow',
      '130',
    );
    await page.getByRole('button', { name: 'Main menu' }).click();
    await page.getByRole('button', { name: 'Ranking', exact: true }).click();
    // The ranking opens on the new 130 s config, which has no records yet.
    await expect(page.getByRole('tabpanel', { name: 'Ranking' })).toContainText('No battles');
    await page
      .getByRole('combobox', { name: 'Battle settings of the ranking' })
      .selectOption('120s-3s');
    await expect(page.getByRole('table')).toBeVisible();
  });
});
