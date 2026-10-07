import { expect, test } from './fixtures/test';
import type { StateSnapshot } from './helpers/game';
import { advance, holdKey, openMatch, snapshot } from './helpers/game';

const QUARTER_TURN_MS = 600; // 90° at 150°/s

const playerBalls = (state: StateSnapshot, cannon: 'front' | 'broadside'): number =>
  state.projectiles.filter((ball) => ball.team === 'player' && ball.cannon === cannon).length;

/**
 * Firing with real key presses on a manual clock. Assertions read the test
 * hook snapshot (projectiles in flight, cooldowns); nothing is set directly.
 */
test.describe('combat input', () => {
  test('Space fires one front ball; Q and E each fire a three-ball broadside', async ({
    page,
    openApp,
  }) => {
    await openMatch(page, openApp);
    // Face east first: broadsides then fire north and south, into open water.
    await holdKey(page, 'KeyD', QUARTER_TURN_MS);
    expect((await snapshot(page)).player.heading).toBeCloseTo(0, 1);
    await page.keyboard.press('Space');
    await advance(page, 50);
    expect(playerBalls(await snapshot(page), 'front')).toBe(1);

    await page.keyboard.press('KeyQ');
    await advance(page, 50);
    expect(playerBalls(await snapshot(page), 'broadside')).toBe(3);

    await page.keyboard.press('KeyE');
    await advance(page, 50);
    const both = await snapshot(page);
    expect(playerBalls(both, 'broadside')).toBe(6);
    expect(both.player.cooldowns.left).toBeGreaterThan(0);
    expect(both.player.cooldowns.right).toBeGreaterThan(0);
  });

  test('holding fire is limited by the weapon cooldown', async ({ page, openApp }) => {
    await openMatch(page, openApp);
    await page.keyboard.down('Space');
    let shots = 0;
    let previous = (await snapshot(page)).player.cooldowns.front;
    // 1.2 s at a 0.5 s cooldown: shots at 0, 0.5 and 1.0 s — never one per frame.
    for (let i = 0; i < 24; i++) {
      await advance(page, 50);
      const cooldown = (await snapshot(page)).player.cooldowns.front;
      if (cooldown > previous) shots += 1;
      previous = cooldown;
    }
    await page.keyboard.up('Space');
    expect(shots).toBe(3);
  });

  test('sails, turns and fires at the same time', async ({ page, openApp }) => {
    await openMatch(page, openApp);
    const start = await snapshot(page);
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyD');
    await page.keyboard.down('Space');
    await page.keyboard.down('KeyQ');
    await advance(page, 400);
    const state = await snapshot(page);
    await page.keyboard.up('KeyQ');
    await page.keyboard.up('Space');
    await page.keyboard.up('KeyD');
    await page.keyboard.up('KeyW');

    expect(state.player.speed).toBeGreaterThan(0);
    expect(state.player.heading).toBeGreaterThan(start.player.heading);
    // Both guns fired (the port broadside may already have hit the fort island).
    expect(state.player.cooldowns.front).toBeGreaterThan(0);
    expect(state.player.cooldowns.left).toBeGreaterThan(0);
    expect(playerBalls(state, 'front')).toBe(1);
  });
});
