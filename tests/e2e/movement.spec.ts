import { expect, test } from './fixtures/test';
import { advance, dispatchKey, holdKey, openMatch, snapshot } from './helpers/game';

/** Hull circles (r 24 at ±18 u) reach 42 u ahead of the ship centre. */
const HULL_REACH = 42;
/** The fort island spans x 128–384, y 128–384 (src/game/core/map/arenaMap.ts). */
const FORT_ISLAND_EAST_EDGE = 384;
const QUARTER_TURN_MS = 600; // 90° at 150°/s

/**
 * Movement driven by real keyboard events on a manual clock (seed 42): the
 * player starts at (448, 288) facing north, with open water around.
 */
test.describe('movement', () => {
  test('W sails forward; A/D and the arrows rotate', async ({ page, openApp }) => {
    await openMatch(page, openApp);
    const start = await snapshot(page);
    expect(start.player).toMatchObject({ x: 448, y: 288, speed: 0 });

    await holdKey(page, 'KeyW', 1000);
    const sailed = await snapshot(page);
    expect(sailed.player.y).toBeLessThan(start.player.y - 50);
    expect(sailed.player.x).toBeCloseTo(start.player.x, 5);

    await holdKey(page, 'KeyA', 300);
    const left = await snapshot(page);
    expect(left.player.heading).toBeLessThan(sailed.player.heading - 0.5);

    await holdKey(page, 'ArrowRight', 300);
    const right = await snapshot(page);
    expect(right.player.heading).toBeGreaterThan(left.player.heading + 0.5);

    await holdKey(page, 'ArrowUp', 500);
    expect((await snapshot(page)).player.speed).toBeGreaterThan(0);
  });

  test('controls follow the physical key: other layouts and Caps Lock work the same', async ({
    page,
    openApp,
  }) => {
    await openMatch(page, openApp);
    const start = await snapshot(page);
    // AZERTY: the key at the QWERTY "W" position types "z" — and it still sails.
    await dispatchKey(page, 'keydown', { code: 'KeyW', key: 'z' });
    await advance(page, 500);
    await dispatchKey(page, 'keyup', { code: 'KeyW', key: 'z' });
    const azerty = await snapshot(page);
    expect(azerty.player.y).toBeLessThan(start.player.y);

    // A "w" typed by another physical key (AZERTY's Z position) is not the forward key.
    await advance(page, 3000); // coast to a stop
    const stopped = await snapshot(page);
    await dispatchKey(page, 'keydown', { code: 'KeyZ', key: 'w' });
    await advance(page, 500);
    await dispatchKey(page, 'keyup', { code: 'KeyZ', key: 'w' });
    expect((await snapshot(page)).player.y).toBeCloseTo(stopped.player.y, 5);

    // Caps Lock / Shift: upper-case "W" on the same physical key.
    await dispatchKey(page, 'keydown', { code: 'KeyW', key: 'W' });
    await advance(page, 500);
    await dispatchKey(page, 'keyup', { code: 'KeyW', key: 'W' });
    expect((await snapshot(page)).player.y).toBeLessThan(stopped.player.y);
  });

  test('the ship cannot cross an island', async ({ page, openApp }) => {
    await openMatch(page, openApp);
    await holdKey(page, 'KeyA', QUARTER_TURN_MS);
    expect(Math.abs((await snapshot(page)).player.heading)).toBeCloseTo(Math.PI, 1);

    await holdKey(page, 'KeyW', 2500);
    const blocked = await snapshot(page);
    // Pressed against the fort island's east shore, never on or past it.
    expect(blocked.player.x - HULL_REACH).toBeGreaterThanOrEqual(FORT_ISLAND_EAST_EDGE - 1);
    expect(blocked.player.x).toBeLessThan(448 - 10);
  });

  test('the ship stays inside the arena', async ({ page, openApp }) => {
    await openMatch(page, openApp);
    // Straight north: 288 u of open water, then the top edge.
    await holdKey(page, 'KeyW', 4000);
    const atEdge = await snapshot(page);
    expect(atEdge.player.y).toBeGreaterThanOrEqual(HULL_REACH - 1);
    expect(atEdge.player.y).toBeLessThan(HULL_REACH + 10);
  });
});
