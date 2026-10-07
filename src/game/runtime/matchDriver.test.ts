import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG } from '../../config/defaults';
import { ManualClock } from '../../shared/clock';
import { getPlayer } from '../core';
import { keySource } from '../input/keymap';
import { MatchDriver } from './matchDriver';

const STEP_MS = 1000 / 60;

function setup() {
  const clock = new ManualClock();
  const driver = new MatchDriver({ config: DEFAULT_GAME_CONFIG, seed: 7, clock });
  driver.start();
  driver.tick();
  const run = (ms: number): void => {
    for (let left = ms; left > 0; left -= STEP_MS) {
      clock.advance(Math.min(STEP_MS, left));
      driver.tick();
    }
  };
  return { clock, driver, run, player: () => getPlayer(driver.world) };
}

describe('MatchDriver pause rules', () => {
  it('runs the simulation only while running', () => {
    const { driver, run } = setup();
    run(1000);
    expect(driver.world.stepCount).toBe(60);
    expect(driver.pause('manual')).toBe(true);
    run(5000);
    expect(driver.world.stepCount).toBe(60);
    expect(driver.state).toBe('paused');
  });

  it('never lets paused wall-clock time into the accumulator', () => {
    const { clock, driver, run } = setup();
    run(500);
    driver.pause('hidden');
    clock.advance(60_000);
    driver.tick();
    expect(driver.resume()).toBe(true);
    driver.tick();
    expect(driver.world.stepCount).toBe(30);
    run(STEP_MS);
    expect(driver.world.stepCount).toBe(31);
  });

  it('freezes weapon cooldowns while paused', () => {
    const { driver, run, player } = setup();
    driver.input.press('fireFront', keySource('Space'));
    run(STEP_MS);
    driver.input.releaseSource(keySource('Space'));
    const cooldown = player().cooldowns.front;
    expect(cooldown).toBeGreaterThan(0);
    driver.pause('manual');
    run(10_000);
    expect(player().cooldowns.front).toBe(cooldown);
  });

  it('clears held input on pause: after resume nothing moves or fires until a new press', () => {
    const { driver, run, player } = setup();
    driver.input.press('forward', keySource('KeyW'));
    driver.input.press('fireFront', keySource('Space'));
    driver.pause('blur');
    expect(driver.input.idle).toBe(true);
    driver.resume();
    const before = { ...player().pos };
    const shots = driver.world.projectiles.length;
    run(1000);
    expect(player().pos).toEqual(before);
    expect(player().speed).toBe(0);
    expect(driver.world.projectiles.length).toBe(shots);

    driver.input.press('forward', keySource('KeyW'));
    run(500);
    expect(player().speed).toBeGreaterThan(0);
  });

  it('keeps the first pause reason and resumes only from pause', () => {
    const { driver } = setup();
    expect(driver.resume()).toBe(false);
    driver.pause('blur');
    expect(driver.pause('manual')).toBe(false);
    expect(driver.pauseReason).toBe('blur');
    driver.resume();
    expect(driver.pauseReason).toBeNull();
    expect(driver.state).toBe('running');
  });

  it('freezes the interpolation alpha while paused', () => {
    const { clock, driver, run } = setup();
    run(STEP_MS * 1.5);
    const alpha = driver.tick();
    driver.pause('manual');
    clock.advance(7);
    expect(driver.tick()).toBe(alpha);
  });

  it('cannot pause an ended match', () => {
    const { driver, run } = setup();
    run((DEFAULT_GAME_CONFIG.match.sessionSeconds + 1) * 1000);
    expect(driver.state).toBe('ended');
    expect(driver.pause('manual')).toBe(false);
  });

  it('hands out each domain event once', () => {
    const { driver, run } = setup();
    driver.input.press('fireFront', keySource('Space'));
    run(STEP_MS);
    expect(driver.drainEvents().some((e) => e.type === 'shotFired')).toBe(true);
    expect(driver.drainEvents()).toEqual([]);
  });

  it('a new driver (restart) starts from a fresh world, clock baseline and input', () => {
    const { clock, driver, run } = setup();
    driver.input.press('forward', keySource('KeyW'));
    run(3000);
    const fresh = new MatchDriver({ config: DEFAULT_GAME_CONFIG, seed: 7, clock });
    fresh.start();
    fresh.tick();
    expect(fresh.world.stepCount).toBe(0);
    expect(fresh.world.score).toBe(0);
    expect(fresh.world.ships).toHaveLength(1);
    expect(fresh.input.idle).toBe(true);
    expect(fresh.state).toBe('running');
  });

  it('samples a scripted source instead of the player input when given one', () => {
    const clock = new ManualClock();
    const driver = new MatchDriver({
      config: DEFAULT_GAME_CONFIG,
      seed: 1,
      clock,
      scripted: {
        sample: () => ({
          forward: true,
          turn: 0,
          fireFront: false,
          fireLeft: false,
          fireRight: false,
        }),
      },
    });
    driver.start();
    driver.tick();
    clock.advance(500);
    driver.tick();
    expect(getPlayer(driver.world).speed).toBeGreaterThan(0);
  });
});
