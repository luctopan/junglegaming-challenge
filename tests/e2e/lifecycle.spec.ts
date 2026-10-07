import { expect, test } from './fixtures/test';
import {
  SESSION_RESOURCES,
  advance,
  expectSessionReleased,
  holdKey,
  leaveGame,
  resources,
  snapshot,
  startGame,
  waitForArena,
} from './helpers/game';

const REPEATED_MATCHES_TIMEOUT_MS = 90_000;

test.describe('game lifecycle', () => {
  test('the test hook exists only in test mode', async ({ page, openApp }) => {
    await openApp('/');
    expect(await page.evaluate(() => '__PIRATE_TEST__' in globalThis)).toBe(false);
    await openApp('/?test=1');
    expect(await page.evaluate(() => '__PIRATE_TEST__' in globalThis)).toBe(true);
  });

  test('leaving the game releases the canvas, ticker, listeners and GPU resources', async ({
    page,
    openApp,
  }) => {
    await openApp('/?test=1');
    await startGame(page);
    await waitForArena(page);
    const running = await resources(page);
    expect(running).toMatchObject({
      applications: 1,
      canvases: 1,
      tickerCallbacks: 1,
      sessions: 1,
    });
    expect(running.displayObjects).toBeGreaterThan(0);
    // Keyboard, touch, blur/visibility and audio-unlock listeners are all counted.
    expect(running.listeners).toBeGreaterThan(5);

    await leaveGame(page);
    await expectSessionReleased(page);
  });

  test('repeated play/exit cycles bring every counter back to baseline', async ({
    page,
    openApp,
  }) => {
    // Three WebGL start-ups on the headless software rasterizer (see ARENA_START_TIMEOUT_MS).
    test.setTimeout(REPEATED_MATCHES_TIMEOUT_MS);
    await openApp('/?test=1&seed=42&clock=manual');
    const snapshots = [];
    for (let i = 0; i < 3; i++) {
      await startGame(page);
      await waitForArena(page);
      // Every cycle starts from a fresh match, whatever the previous one did.
      expect(await snapshot(page)).toMatchObject({ stepCount: 0, score: 0, phase: 'running' });
      const report = await resources(page);
      snapshots.push(
        SESSION_RESOURCES.filter(
          (k) => k !== 'displayObjects' && k !== 'dynamicTextures' && k !== 'audioLoops',
        ).map((k) => report[k]),
      );
      // Play a little: sail, fire, pause and resume, then leave from the pause menu.
      await page.keyboard.down('KeyW');
      await holdKey(page, 'Space', 500);
      await page.keyboard.up('KeyW');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Resume' }).click();
      await advance(page, 3500);
      await leaveGame(page);
      await expectSessionReleased(page);
    }
    expect(snapshots[1]).toEqual(snapshots[0]);
    expect(snapshots[2]).toEqual(snapshots[0]);
  });
});
