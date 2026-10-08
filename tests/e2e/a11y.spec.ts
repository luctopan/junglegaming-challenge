import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import {
  expect,
  NETWORK_FAILURE_LOG,
  readStorage,
  seedMockRecords,
  seedStorage,
  test,
} from './fixtures/test';
import { advance, openMatch, waitForArena } from './helpers/game';

/**
 * Automated accessibility smoke checks (axe-core: roles, names, labels, ARIA
 * use, contrast where the background is a colour) on every screen, plus the
 * live region and the persisted sound toggle. Contrast against the atlas art
 * itself is checked by tests/tooling/contrast.test.ts (axe cannot read images).
 */
async function expectNoViolations(page: Page, screen: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
  );
  expect(summary, `axe violations on ${screen}`).toEqual([]);
}

const LAST_RESULT = JSON.stringify({
  matchId: '7d1f3c2a-9b8e-4f6d-a5c4-3b2a1f0e9d8c',
  playerId: '0b5e7a52-3c1d-4f7e-9a2b-6c8d0e1f2a3b',
  playerName: 'Test Captain',
  playedAt: '2026-09-08T19:36:00.000Z',
  score: 24,
  durationMs: 98_500,
  endReason: 'defeated',
  config: { sessionSeconds: 120, spawnIntervalSeconds: 3 },
});

test.describe('accessibility (axe)', () => {
  test('menu, controls dialog and captain dialog', async ({ page, openApp }) => {
    await openApp('/');
    await expectNoViolations(page, 'menu');
    await page.getByRole('button', { name: 'Controls' }).click();
    await expectNoViolations(page, 'controls dialog');
  });

  test('options, with an invalid entry shown', async ({ page, openApp }) => {
    await openApp('/options');
    await expectNoViolations(page, 'options');
    const field = page.getByRole('spinbutton', { name: 'Game session time' });
    await field.fill('500');
    await field.press('Enter');
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expectNoViolations(page, 'options with an error');
  });

  test('in-game HUD and pause menu', async ({ page, openApp }) => {
    await openMatch(page, openApp);
    await expectNoViolations(page, 'HUD');
    await page.getByRole('button', { name: 'Pause' }).click();
    await expectNoViolations(page, 'pause');
    await page.getByRole('button', { name: 'Options' }).click();
    await expectNoViolations(page, 'pause options');
  });

  test('result and records panel', async ({ page, openApp, allowConsoleError }) => {
    allowConsoleError(NETWORK_FAILURE_LOG);
    await seedStorage(page, 'pirate.lastResult.v1', LAST_RESULT);
    await seedMockRecords(page, [JSON.parse(LAST_RESULT) as Record<string, unknown>]);
    await openApp('/result');
    await expect(page.getByRole('heading', { name: 'Battle complete' })).toBeVisible();
    await expectNoViolations(page, 'result');

    await openApp('/records/ranking?test=1');
    await expect(page.getByRole('table')).toBeVisible();
    await expectNoViolations(page, 'ranking');
    await page.getByRole('tab', { name: 'Match history' }).click();
    await expect(page.getByRole('table')).toBeVisible();
    await expectNoViolations(page, 'history');
    await openApp('/records/ranking?test=1&scenario=ranking-fail');
    await expect(page.getByRole('alert')).toBeVisible();
    await expectNoViolations(page, 'records error');
  });
});

test.describe('accessibility (axe), first visit', () => {
  test.use({ captainName: null });

  test('captain name dialog with an error', async ({ page, openApp }) => {
    await openApp('/');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.getByRole('button', { name: 'Set sail' }).click();
    await expect(page.getByRole('alert')).toHaveText('Enter at least 2 characters.');
    await expectNoViolations(page, 'captain dialog');
  });
});

/** Every text the live region gets, recorded in the page (it may change faster than polling). */
async function recordAnnouncements(page: Page): Promise<() => Promise<string[]>> {
  await page.evaluate(() => {
    const dom = globalThis as unknown as {
      document: { querySelector(s: string): { textContent: string | null } | null };
      MutationObserver: new (cb: () => void) => { observe(n: unknown, o: unknown): void };
      __announced: string[];
    };
    const region = dom.document.querySelector('[data-testid="match-announcer"]');
    dom.__announced = [];
    new dom.MutationObserver(() => {
      dom.__announced.push(region?.textContent ?? '');
    }).observe(region, { childList: true, characterData: true, subtree: true });
  });
  return () =>
    page.evaluate(() => (globalThis as unknown as { __announced: string[] }).__announced);
}

test.describe('live region', () => {
  test('announces state, time marks and score, not every second', async ({ page, openApp }) => {
    // Few enemies, so the idle test ship is still afloat at the 90 s mark.
    await seedStorage(
      page,
      'pirate.options.v1',
      JSON.stringify({ sessionSeconds: 120, spawnIntervalSeconds: 10 }),
    );
    await openMatch(page, openApp);
    const region = page.getByTestId('match-announcer');
    await expect(region).toHaveAttribute('aria-live', 'polite');
    await expect(region).toHaveText('Battle started: 2 minutes, hull 200 of 200.');

    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(region).toHaveText('Paused.');
    await page.getByRole('button', { name: 'Resume' }).click();
    await expect(region).toHaveText('Resumed.');

    const announced = await recordAnnouncements(page);
    await advance(page, 31_000);
    const said = await announced();
    // 31 timer changes, one time announcement: the timer is never read every second.
    expect(said.filter((text) => text.includes('left.'))).toEqual(['1 minute 30 seconds left.']);
    expect(said.length).toBeLessThan(10);
  });
});

test.describe('sound', () => {
  test('the mute toggle is persisted and shared by the menu and the HUD', async ({
    page,
    openApp,
  }) => {
    await openApp('/?test=1&clock=manual');
    const mute = page.getByRole('button', { name: 'Mute sound' });
    await expect(mute).toHaveAttribute('aria-pressed', 'false');
    await mute.click();
    await expect(mute).toHaveAttribute('aria-pressed', 'true');
    expect(await readStorage(page, 'pirate.audio.v1')).toEqual({ muted: true });

    await page.reload();
    await expect(page.getByRole('button', { name: 'Mute sound' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    // The HUD appears once WebGL has started (slow on CI's software rasterizer).
    await waitForArena(page);
    const hudMute = page.getByRole('button', { name: 'Mute sound' });
    await expect(hudMute).toHaveAttribute('aria-pressed', 'true');
    await hudMute.click();
    await expect(hudMute).toHaveAttribute('aria-pressed', 'false');
    expect(await readStorage(page, 'pirate.audio.v1')).toEqual({ muted: false });
  });
});
