import { expect, test } from './fixtures/test';
import { advance, openMatch, playToTheEnd, snapshot, useShortMatches } from './helpers/game';

/**
 * Visual regression of the menu, a stable arena state and the Result screen.
 * Baselines come only from the pinned Linux image (`pnpm test:e2e:update`),
 * the same one CI uses, so fonts and software WebGL output match.
 * Seed 42 + manual clock make the arena frame identical on every run.
 */
const SHOT = { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.01 } as const;

test.describe('visual regression', () => {
  // Baselines are Linux renders; on another host OS run `pnpm test:e2e:docker`.
  test.skip(process.platform !== 'linux', 'visual baselines are produced in the Linux image');

  test('main menu', async ({ page, openApp }) => {
    await openApp('/');
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    await expect(page).toHaveScreenshot('menu.png', SHOT);
  });

  test('arena in a stable state', async ({ page, openApp }) => {
    await openMatch(page, openApp);
    // Two enemies on screen, the player at rest, no balls in flight.
    await advance(page, 6500, 500);
    expect((await snapshot(page)).enemies.length).toBeGreaterThan(0);
    await expect(page).toHaveScreenshot('arena.png', SHOT);
  });

  test('result screen', async ({ page, openApp }) => {
    await useShortMatches(page);
    await openMatch(page, openApp);
    await playToTheEnd(page);
    await expect(page.getByTestId('submission-status')).toHaveText(
      'Saved to the ranking and your match history.',
    );
    await expect(page).toHaveScreenshot('result.png', SHOT);
  });
});
