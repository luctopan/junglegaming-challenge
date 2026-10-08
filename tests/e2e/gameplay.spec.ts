import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/test';
import type { StateSnapshot } from './helpers/game';
import {
  advance,
  holdKey,
  openMatch,
  playToTheEnd,
  snapshot,
  startGame,
  useShortMatches,
  waitForArena,
} from './helpers/game';

/**
 * Rules seen through the real game loop: seed 42 and the manual clock make
 * every run identical (an idle player at the spawn point, default Options
 * 120 s / 3 s). Combat presses real keys; the snapshot only observes.
 */
type Enemy = StateSnapshot['enemies'][number];

const distanceTo = (state: StateSnapshot, enemy: Enemy): number =>
  Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);

const alive = (state: StateSnapshot, kind?: Enemy['kind']): Enemy[] =>
  state.enemies.filter((e) => e.alive && (kind === undefined || e.kind === kind));

/** Advances to an absolute simulation time (seconds). */
async function advanceTo(page: Page, seconds: number): Promise<StateSnapshot> {
  const now = (await snapshot(page)).elapsedSeconds;
  await advance(page, Math.max(0, Math.round((seconds - now) * 1000)), 500);
  return snapshot(page);
}

const TURN_RATE_RAD_PER_MS = (150 * Math.PI) / 180 / 1000;
const AIM_TOLERANCE_RAD = 0.08;
const wrap = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle));

test.describe('gameplay rules', () => {
  test('enemies spawn on the configured interval', async ({ page, openApp }) => {
    await openMatch(page, openApp);
    expect(alive(await advanceTo(page, 2.9))).toHaveLength(0);
    expect(alive(await advanceTo(page, 3.1))).toHaveLength(1);
    expect(alive(await advanceTo(page, 5.9))).toHaveLength(1);
    expect(alive(await advanceTo(page, 6.1))).toHaveLength(2);
    expect(alive(await advanceTo(page, 9.1))).toHaveLength(3);
  });

  test('a Shooter stops at its standoff distance and fires at the player', async ({
    page,
    openApp,
  }) => {
    await openMatch(page, openApp);
    const approaching = await advanceTo(page, 4);
    const [shooter] = alive(approaching, 'shooter');
    if (shooter === undefined) throw new Error('seed 42 spawns a Shooter first');
    const start = distanceTo(approaching, shooter);

    const holding = await advanceTo(page, 8.5);
    const held = holding.enemies.find((e) => e.id === shooter.id);
    if (held === undefined) throw new Error('Shooter missing');
    expect(distanceTo(holding, held)).toBeLessThan(start - 200);
    // It holds its position instead of ramming.
    const later = await advanceTo(page, 9.0);
    const still = later.enemies.find((e) => e.id === shooter.id);
    if (still === undefined) throw new Error('Shooter missing');
    expect(Math.abs(distanceTo(later, still) - distanceTo(holding, held))).toBeLessThan(5);
    // Its ball hits the idle player: 7 damage, no score.
    const hit = await advanceTo(page, 9.5);
    expect(hit.player.hp).toBe(193);
    expect(hit.score).toBe(0);
  });

  test('Chasers close in and ram: the player is damaged, the Chaser sinks, no score', async ({
    page,
    openApp,
  }) => {
    await openMatch(page, openApp);
    const early = await advanceTo(page, 6.5);
    const [chaser] = alive(early, 'chaser');
    if (chaser === undefined) throw new Error('seed 42 spawns a Chaser at 6 s');
    const closer = await advanceTo(page, 10);
    const tracked = closer.enemies.find((e) => e.id === chaser.id);
    if (tracked === undefined) throw new Error('Chaser missing');
    expect(distanceTo(closer, tracked)).toBeLessThan(distanceTo(early, chaser) - 150);

    const before = await advanceTo(page, 12.5);
    const after = await advanceTo(page, 13.5);
    // Two rams of 20 each; both Chasers are wrecks; rams never score.
    expect(before.player.hp - after.player.hp).toBe(40);
    expect(alive(after, 'chaser')).toHaveLength(0);
    expect(after.score).toBe(0);
  });

  test('front shots damage an enemy and a sink scores exactly once', async ({ page, openApp }) => {
    test.setTimeout(90_000);
    await openMatch(page, openApp);
    await advanceTo(page, 3.2);
    let damaged = false;
    let state = await snapshot(page);
    for (let i = 0; i < 80 && state.score === 0; i++) {
      const target = alive(state).sort((a, b) => distanceTo(state, a) - distanceTo(state, b))[0];
      if (target === undefined) {
        await advance(page, 200);
      } else {
        const bearing = Math.atan2(target.y - state.player.y, target.x - state.player.x);
        const off = wrap(bearing - state.player.heading);
        if (Math.abs(off) > AIM_TOLERANCE_RAD) {
          const ms = Math.max(17, Math.min(300, Math.abs(off) / TURN_RATE_RAD_PER_MS));
          await holdKey(page, off > 0 ? 'KeyD' : 'KeyA', ms);
        } else {
          await page.keyboard.press('Space');
          await advance(page, 150);
        }
      }
      state = await snapshot(page);
      damaged ||= state.enemies.some((e) => e.alive && e.hp > 0 && e.hp < 50 && e.hp !== 30);
    }
    expect(damaged, 'an enemy took damage without sinking').toBe(true);
    expect(state.score).toBe(1);
    await expect(page.getByTestId('hud-score')).toHaveText('1');

    // Balls still in flight land or expire; the wreck never scores again.
    await advance(page, 1000);
    const settled = (await snapshot(page)).score;
    await advance(page, 1500);
    expect((await snapshot(page)).score).toBe(settled);
    expect(settled).toBeGreaterThanOrEqual(1);
  });

  test('time up ends the match and stops the simulation', async ({ page, openApp }) => {
    await useShortMatches(page);
    // With seed 7 the idle ship survives the 60 s battle (seed 42 sinks it at the end).
    await openApp('/?test=1&seed=7&clock=manual');
    await startGame(page);
    await waitForArena(page);
    await expect.poll(async () => (await snapshot(page)).phase).toBe('running');
    await playToTheEnd(page);
    const ended = await snapshot(page);
    expect(ended.endReason).toBe('time_up');
    expect(ended.timeLeftSeconds).toBe(0);
    await advance(page, 2000);
    const later = await snapshot(page);
    expect(later.stepCount).toBe(ended.stepCount);
    expect(later.enemies).toEqual(ended.enemies);
  });

  test('sinking ends the match as Defeated and stops the simulation', async ({ page, openApp }) => {
    test.setTimeout(120_000);
    await openMatch(page, openApp);
    let state = await snapshot(page);
    for (let i = 0; i < 24 && state.phase !== 'ended'; i++) {
      await advance(page, 5000, 1000);
      state = await snapshot(page);
    }
    expect(state.endReason).toBe('defeated');
    expect(state.player.alive).toBe(false);
    expect(state.player.hp).toBe(0);
    expect(state.timeLeftSeconds).toBeGreaterThan(0);
    const dialog = page.getByRole('dialog', { name: 'Battle complete' });
    await expect(dialog.getByTestId('result-summary')).toContainText('Defeated');
    await advance(page, 2000);
    expect((await snapshot(page)).stepCount).toBe(state.stepCount);
  });
});
