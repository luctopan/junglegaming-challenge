import { describe, expect, it } from 'vitest';
import { getPlayer } from '../ships';
import { step } from '../step';
import { configWith, input, ofType, place, quietWorld, run, stepsFor } from '../testing/fixtures';
import { OPEN_MAP } from '../testing/maps';
import { timeLeftSeconds } from './match';

const oneMinute = configWith((c) => {
  c.match.sessionSeconds = 60;
});

describe('match rules', () => {
  it('ends with time_up exactly when the session time is over', () => {
    const world = quietWorld(oneMinute);
    const before = run(world, stepsFor(world, 60) - 1);
    expect(ofType(before, 'matchEnded')).toHaveLength(0);
    expect(timeLeftSeconds(world)).toBeCloseTo(1 / 60);
    const events = step(world, input({}));
    expect(ofType(events, 'matchEnded')).toEqual([
      expect.objectContaining({ reason: 'time_up', score: 0, time: 60 }),
    ]);
    expect(world.phase).toBe('ended');
    expect(timeLeftSeconds(world)).toBe(0);
  });

  it('counts time as steps × dt, without float drift', () => {
    const world = quietWorld();
    run(world, 7199);
    expect(world.elapsedSeconds).toBe(7199 * world.cfg.simulation.stepSeconds);
    expect(world.phase).toBe('running');
    run(world, 1);
    expect(world.endReason).toBe('time_up');
  });

  it('ends with defeated when the player HP reaches 0', () => {
    const world = quietWorld(undefined, { map: OPEN_MAP });
    getPlayer(world).hp = 10;
    getPlayer(world).pos = { x: 300, y: 500 };
    place(world, 'chaser', { x: 300, y: 400 }, Math.PI / 2);
    const events = run(world, stepsFor(world, 3));
    expect(world.endReason).toBe('defeated');
    expect(ofType(events, 'matchEnded')).toHaveLength(1);
  });

  it('reports defeated when death and time-up happen on the same step', () => {
    const world = quietWorld(oneMinute, { map: OPEN_MAP });
    const player = getPlayer(world);
    player.hp = 1;
    player.pos = { x: 300, y: 500 };
    world.stepCount = stepsFor(world, 60) - 1;
    // Already touching: the ram lands on the final step.
    place(world, 'chaser', { x: 300, y: 430 }, Math.PI / 2);
    const events = step(world, input({}));
    expect(ofType(events, 'chaserRammed')).toHaveLength(1);
    expect(world.elapsedSeconds).toBeCloseTo(60);
    expect(world.endReason).toBe('defeated');
  });

  it('freezes movement, attacks, damage, spawns and score once ended', () => {
    const world = quietWorld(oneMinute, { map: OPEN_MAP });
    run(world, stepsFor(world, 59.9), input({ forward: true, turn: 1 }));
    step(world, input({ fireFront: true }));
    run(world, stepsFor(world, 0.1));
    expect(world.phase).toBe('ended');
    const frozen = JSON.stringify(world);
    const events = run(world, 120, input({ forward: true, fireFront: true, fireLeft: true }));
    expect(events).toEqual([]);
    expect(JSON.stringify(world)).toBe(frozen);
  });
});
