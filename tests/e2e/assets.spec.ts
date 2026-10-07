import { expect, test } from './fixtures/test';
import { resources, startGame, waitForArena } from './helpers/game';

/** Every resolution of the ship sheet: Pixi picks 1× or @2x from the screen density. */
const SHIP_SHEETS = '**/assets/ships/ships_sheet*.png';

/**
 * Asset loading before combat: visible progress, a failure state with Retry
 * (provoked with plain route interception, no special app code path), and
 * textures loaded once per page.
 */
test.describe('game assets', () => {
  test('shows loading progress before the arena appears', async ({ page, openApp }) => {
    // Hold the tile atlas back so the progress state is observable.
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.context().route('**/assets/tiles/**', async (route) => {
      await held;
      await route.continue();
    });
    await openApp('/?test=1');
    await startGame(page);

    const progress = page.getByRole('progressbar', { name: 'Loading the fleet…' });
    await expect(progress).toBeVisible();
    await expect(progress).toHaveAttribute('aria-valuenow', /^\d+$/);
    expect((await resources(page)).canvases).toBe(0);

    release();
    await waitForArena(page);
    expect((await resources(page)).applications).toBe(1);
  });

  test('a failed download shows Retry and never starts combat; Retry recovers', async ({
    page,
    openApp,
    allowConsoleError,
  }) => {
    allowConsoleError(/Failed to load resource/);
    await page.context().route(SHIP_SHEETS, (route) => route.abort('failed'));
    await openApp('/?test=1');
    await startGame(page);

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Could not load the game assets');
    const before = await resources(page);
    expect(before.applications).toBe(0);
    expect(before.canvases).toBe(0);
    expect(before.tickerCallbacks).toBe(0);

    await page.context().unroute(SHIP_SHEETS);
    await alert.getByRole('button', { name: 'Retry' }).click();
    await waitForArena(page);
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect((await resources(page)).sessions).toBe(1);
  });

  test('loads the atlases once and reuses them for the next match', async ({ page, openApp }) => {
    const atlasRequests: string[] = [];
    page.on('request', (request) => {
      if (/\/assets\/(ships|tiles|ui)\/.*\.(png|json)$/.test(request.url())) {
        atlasRequests.push(request.url());
      }
    });
    await openApp('/?test=1');
    await startGame(page);
    await waitForArena(page);
    const firstLoad = atlasRequests.length;
    const textures = (await resources(page)).cachedTextures;
    expect(firstLoad).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Main menu' }).click();
    await startGame(page);
    await waitForArena(page);
    expect(atlasRequests).toHaveLength(firstLoad);
    expect((await resources(page)).cachedTextures).toBe(textures);
  });
});
