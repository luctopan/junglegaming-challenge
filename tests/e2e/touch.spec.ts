import type { CDPSession, Page } from '@playwright/test';
import { expect, test } from './fixtures/test';
import type { BrowserGlobals, StateSnapshot } from './helpers/game';
import { advance, openMatch, snapshot } from './helpers/game';

interface Point {
  x: number;
  y: number;
  id: number;
}

/**
 * Real multi-touch through the Chrome DevTools Protocol: Chromium turns these
 * into touch pointer events (one pointer per finger), exactly like a phone.
 * Playwright's own touchscreen API only taps.
 */
class Fingers {
  readonly #down = new Map<number, Point>();
  private constructor(private readonly cdp: CDPSession) {}

  static async on(page: Page): Promise<Fingers> {
    return new Fingers(await page.context().newCDPSession(page));
  }

  async press(id: number, target: { x: number; y: number }): Promise<void> {
    this.#down.set(id, { ...target, id });
    await this.cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [...this.#down.values()],
    });
  }

  /** Chromium releases the points listed in a touchEnd; the other fingers stay down. */
  async lift(id: number): Promise<void> {
    const point = this.#down.get(id);
    if (point === undefined) return;
    this.#down.delete(id);
    await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [point] });
  }

  async cancel(): Promise<void> {
    this.#down.clear();
    await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  }
}

async function centreOf(page: Page, name: string): Promise<{ x: number; y: number }> {
  const box = await page.getByRole('button', { name }).boundingBox();
  if (box === null) throw new Error(`Control "${name}" is not on screen`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

const playerBalls = (state: StateSnapshot): number =>
  state.projectiles.filter((ball) => ball.team === 'player').length;

test.describe('touch controls', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'touch input runs on the mobile project');

  test('steer and fire at the same time with two fingers', async ({ page, openApp }) => {
    await openMatch(page, openApp);
    const fingers = await Fingers.on(page);
    const start = await snapshot(page);

    await fingers.press(1, await centreOf(page, 'Sail forward'));
    await fingers.press(2, await centreOf(page, 'Fire front cannon'));
    await advance(page, 600);
    const both = await snapshot(page);
    expect(both.player.speed).toBeGreaterThan(0);
    expect(both.player.y).toBeLessThan(start.player.y);
    // Fired at 0 s and again at 0.5 s (cooldown): the gun stayed held. The first ball may
    // already have left the arena through the top edge.
    expect(playerBalls(both)).toBeGreaterThanOrEqual(1);
    expect(both.player.cooldowns.front).toBeGreaterThan(0.3);

    // Lifting the firing finger leaves the other one sailing.
    await fingers.lift(2);
    await advance(page, 600);
    const sailing = await snapshot(page);
    expect(sailing.player.cooldowns.front).toBe(0);
    expect(sailing.player.speed).toBeGreaterThan(0);
    expect(sailing.inputIdle).toBe(false);

    await fingers.lift(1);
    await advance(page, 50);
    expect((await snapshot(page)).inputIdle).toBe(true);
  });

  test('a cancelled touch releases everything it held', async ({ page, openApp }) => {
    await openMatch(page, openApp);
    const fingers = await Fingers.on(page);
    await fingers.press(1, await centreOf(page, 'Turn left'));
    await fingers.press(2, await centreOf(page, 'Sail forward'));
    await advance(page, 300);
    expect((await snapshot(page)).inputIdle).toBe(false);

    await fingers.cancel();
    await advance(page, 50);
    const released = await snapshot(page);
    expect(released.inputIdle).toBe(true);
    await advance(page, 500);
    expect((await snapshot(page)).player.heading).toBeCloseTo(released.player.heading, 5);
  });

  test('a finger held through a pause does nothing after resuming until it presses again', async ({
    page,
    openApp,
  }) => {
    await openMatch(page, openApp);
    const fingers = await Fingers.on(page);
    const forward = await centreOf(page, 'Sail forward');
    await fingers.press(1, forward);
    await advance(page, 300);

    await page.getByRole('button', { name: 'Pause' }).tap();
    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
    expect((await snapshot(page)).inputIdle).toBe(true);
    await page.getByRole('button', { name: 'Resume' }).tap();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await advance(page, 3000); // coast to a stop
    const coasted = await snapshot(page);
    await advance(page, 500);
    expect((await snapshot(page)).player.y).toBeCloseTo(coasted.player.y, 5);

    await fingers.lift(1);
    await fingers.press(1, forward);
    await advance(page, 500);
    expect((await snapshot(page)).player.y).toBeLessThan(coasted.player.y);
    await fingers.lift(1);
  });

  test('controls block scrolling, selection and the long-press menu', async ({ page, openApp }) => {
    await openMatch(page, openApp);
    const style = await page.evaluate(() => {
      const dom = globalThis as unknown as BrowserGlobals;
      const element = dom.document.querySelector('[aria-label="Fire left broadside"]');
      if (element === null) throw new Error('control missing');
      const css = dom.getComputedStyle(element);
      const contextMenu = new dom.MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      element.dispatchEvent(contextMenu);
      return {
        touchAction: css.touchAction,
        userSelect: css.userSelect,
        contextMenuPrevented: contextMenu.defaultPrevented,
      };
    });
    expect(style).toEqual({ touchAction: 'none', userSelect: 'none', contextMenuPrevented: true });
  });
});
