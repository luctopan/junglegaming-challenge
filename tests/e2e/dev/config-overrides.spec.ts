import { expect, test } from '../fixtures/test';
import { snapshot, startGame, waitForArena } from '../helpers/game';

/**
 * Dev-server-only balance overrides (`?cfg.<path>=<value>`, README). The
 * production bundle ignores them (tests/e2e/hud.spec.ts) and does not contain
 * the parser (scripts/verify-dist.mjs).
 */
test.describe('dev balance overrides', () => {
  test('valid overrides change the next match', async ({ page, openApp }) => {
    const warnings: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'warning') warnings.push(message.text());
    });
    await openApp(
      '/?test=1&cfg.ships.player.maxHp=150&cfg.weapons.shooterCannon.projectileSpeed=300',
    );
    await startGame(page);
    await waitForArena(page);
    await expect(page.getByTestId('hud-hp')).toHaveText('150 / 150');
    expect((await snapshot(page)).player.maxHp).toBe(150);
    expect(warnings).toContainEqual(
      expect.stringContaining(
        'Balance overrides active: ships.player.maxHp=150, weapons.shooterCannon.projectileSpeed=300',
      ),
    );
  });

  test('invalid overrides are ignored with a clear console warning', async ({ page, openApp }) => {
    const warnings: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'warning') warnings.push(message.text());
    });
    await openApp('/?test=1&cfg.ships.player.maxHp=-5&cfg.ships.player.speed=10');
    await startGame(page);
    await waitForArena(page);
    await expect(page.getByTestId('hud-hp')).toHaveText('200 / 200');
    expect(warnings).toContainEqual(
      expect.stringContaining(
        'Ignoring cfg.ships.player.maxHp=-5: ships.player.maxHp must be a finite number > 0',
      ),
    );
    expect(warnings).toContainEqual(
      expect.stringContaining('Ignoring cfg.ships.player.speed=10: unknown setting'),
    );
  });
});
