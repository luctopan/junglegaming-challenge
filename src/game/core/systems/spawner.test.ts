import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG } from '../../../config/defaults';
import { distance } from '../../../shared/math/vec2';
import { createMatch } from '../createMatch';
import { circleRectPushOut } from '../geometry';
import { aliveEnemies, getPlayer } from '../ships';
import { step } from '../step';
import { configWith, ofType, run, stepsFor } from '../testing/fixtures';
import type { World } from '../types';
import { IDLE_INPUT } from '../types';
import { destroyShip } from './damage';
import { pendingSpawns } from './spawner';

/** Player that cannot die, so spawning runs for the whole session. */
const sturdy = configWith((c) => {
  c.ships.player.maxHp = 1e9;
  c.match.sessionSeconds = 60;
});

const destroyAllEnemies = (world: World): void => {
  for (const enemy of aliveEnemies(world)) destroyShip(world, [], enemy, 'projectile', 'enemy');
};

describe('spawner', () => {
  it('first spawn happens at t = interval', () => {
    const world = createMatch(DEFAULT_GAME_CONFIG, 5);
    const events = run(world, stepsFor(world, 3) - 1);
    expect(ofType(events, 'enemySpawned')).toHaveLength(0);
    const [spawn] = ofType(step(world, IDLE_INPUT), 'enemySpawned');
    expect(spawn?.time).toBeCloseTo(3);
  });

  it('spawns every interval until the match ends, never skipping one', () => {
    const cfg = configWith((c) => {
      Object.assign(c, JSON.parse(JSON.stringify(sturdy)));
      c.spawn.intervalSeconds = 2;
      c.spawn.maxAliveEnemies = 1000;
    });
    const world = createMatch(cfg, 11);
    const spawns = ofType(run(world, stepsFor(world, 60) + 10), 'enemySpawned');
    expect(world.endReason).toBe('time_up');
    // Due at 2, 4, …, 58 (the spawn due at t = 60 coincides with the end).
    expect(spawns).toHaveLength(29);
    spawns.forEach((spawn, i) => {
      expect(spawn.time).toBeGreaterThanOrEqual((i + 1) * 2 - 1e-9);
      expect(spawn.time).toBeLessThan((i + 1) * 2 + 0.25);
    });
  });

  it('places enemies on clear water far from the player', () => {
    const world = createMatch(sturdy, 3);
    for (let i = 0; i < stepsFor(world, 60); i++) {
      for (const spawn of ofType(step(world, IDLE_INPUT), 'enemySpawned')) {
        expect(distance(spawn.pos, getPlayer(world).pos)).toBeGreaterThanOrEqual(320);
        const blocked = world.arena.islandRects.some(
          (r) => circleRectPushOut(spawn.pos, world.cfg.spawn.clearanceRadius, r) !== null,
        );
        expect(blocked).toBe(false);
      }
    }
  });

  it.each(Array.from({ length: 30 }, (_, i) => i + 1))(
    'seed %i: both enemy types appear among the first two spawns of a default match',
    (seed) => {
      const world = createMatch(DEFAULT_GAME_CONFIG, seed);
      run(world, stepsFor(world, 6.1));
      expect(world.spawner.spawnedByKind).toEqual({ chaser: 1, shooter: 1 });
    },
  );

  it('keeps blocked spawns pending and catches up without shifting the cadence', () => {
    const cfg = configWith((c) => {
      Object.assign(c, JSON.parse(JSON.stringify(sturdy)));
      c.spawn.intervalSeconds = 1;
      c.spawn.maxAliveEnemies = 2;
      c.spawn.weights = { chaser: 0, shooter: 1 };
      c.spawn.guaranteeEachKindInFirstTwo = false;
    });
    const world = createMatch(cfg, 8);
    run(world, stepsFor(world, 5));
    expect(world.spawner.spawned).toBe(2);
    expect(pendingSpawns(world)).toBe(3);

    destroyAllEnemies(world);
    run(world, 1);
    expect(world.spawner.spawned).toBe(4);
    destroyAllEnemies(world);
    run(world, 1);
    expect(world.spawner.spawned).toBe(5);
    expect(pendingSpawns(world)).toBe(0);

    // The next spawn is still due at t = 6 s, not one interval after the late ones.
    const spawns = ofType(run(world, stepsFor(world, 6) - world.stepCount), 'enemySpawned');
    expect(spawns).toHaveLength(1);
    expect(spawns[0]?.time).toBeCloseTo(6);
  });

  it('retries when no spawn point is valid instead of dropping the spawn', () => {
    const cfg = configWith((c) => {
      c.spawn.minDistanceFromPlayer = 5000;
    });
    const world = createMatch(cfg, 2);
    const events = run(world, stepsFor(world, 9));
    expect(ofType(events, 'enemySpawned')).toHaveLength(0);
    expect(pendingSpawns(world)).toBe(3);
  });

  it('can be disabled for isolated scenarios', () => {
    const world = createMatch(DEFAULT_GAME_CONFIG, 2, { spawnEnemies: false });
    run(world, stepsFor(world, 10));
    expect(world.spawner.spawned).toBe(0);
  });
});
