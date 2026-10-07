import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/test';
import {
  advance,
  dispatchKey,
  expectSessionReleased,
  holdKey,
  leaveGame,
  openMatch,
  resources,
  snapshot,
  startGame,
  waitForArena,
} from './helpers/game';

/** Requests that could register a match (none exist before Phase 5; none may ever fire for an abandoned one). */
function watchMatchWrites(page: Page): string[] {
  const writes: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/') && request.method() !== 'GET') writes.push(request.url());
  });
  return writes;
}

const storedKeys = (page: Page): Promise<string[]> =>
  page.evaluate(() => Object.keys(globalThis.localStorage));

/** Simulates the whole session (120 s by default) until the match ends. */
const PLAY_TO_THE_END_TIMEOUT_MS = 120_000;

test.describe('abandon and restart', () => {
  test('leaving mid-match abandons it: nothing recorded, everything released', async ({
    page,
    openApp,
  }) => {
    const writes = watchMatchWrites(page);
    await openMatch(page, openApp);
    const keysBefore = await storedKeys(page);
    await holdKey(page, 'KeyW', 1000);
    await advance(page, 3000);

    await leaveGame(page);
    await expectSessionReleased(page);
    expect(writes).toEqual([]);
    expect(await storedKeys(page)).toEqual(keysBefore);
  });

  test('reloading mid-match ends it and opens the main menu', async ({ page, openApp }) => {
    const writes = watchMatchWrites(page);
    await openMatch(page, openApp);
    await advance(page, 2000);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-msw', 'ready');

    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
    await expectSessionReleased(page);
    expect(writes).toEqual([]);
  });

  test('Play again starts a completely fresh match on the same canvas', async ({
    page,
    openApp,
  }) => {
    test.setTimeout(PLAY_TO_THE_END_TIMEOUT_MS);
    await openMatch(page, openApp);
    const fresh = await snapshot(page);
    const firstMatch = await resources(page);

    await holdKey(page, 'KeyW', 1500);
    await page.keyboard.press('Space');
    await advance(page, 125_000, 5_000);
    const ended = await snapshot(page);
    expect(ended.phase).toBe('ended');
    const panel = page.getByRole('dialog');
    await expect(panel).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pause' })).toHaveCount(0);

    await panel.getByRole('button', { name: 'Play again' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const restarted = await snapshot(page);
    expect(restarted).toEqual({ ...fresh, phase: 'running' });
    expect(restarted.enemies).toEqual([]);
    expect(restarted.projectiles).toEqual([]);
    await expect(page.getByTestId('hud-time')).toHaveText('2:00');

    const secondMatch = await resources(page);
    for (const key of [
      'applications',
      'canvases',
      'tickerCallbacks',
      'listeners',
      'observers',
      'sessions',
    ] as const) {
      expect(secondMatch[key], key).toBe(firstMatch[key]);
    }

    // The new match runs and takes input.
    await holdKey(page, 'KeyW', 500);
    expect((await snapshot(page)).player.y).toBeLessThan(fresh.player.y);
  });

  test('game keys stop being captured once the screen is left', async ({ page, openApp }) => {
    await openApp('/?test=1');
    await startGame(page);
    await waitForArena(page);
    await leaveGame(page);
    expect(await dispatchKey(page, 'keydown', { code: 'Space', key: ' ' })).toBe(false);
  });
});
