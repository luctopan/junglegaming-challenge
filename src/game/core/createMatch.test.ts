import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG } from '../../config/defaults';
import { createMatch, InvalidMatchConfigError } from './createMatch';
import { damageStage } from './damageStage';
import { getPlayer } from './ships';
import type { GameConfig } from '../../config/gameConfig';
import type { Mutable } from './testing/fixtures';
import { configWith } from './testing/fixtures';

describe('createMatch', () => {
  it('creates a running match with the player at the configured spawn', () => {
    const world = createMatch(DEFAULT_GAME_CONFIG, 42);
    const player = getPlayer(world);
    expect(world.phase).toBe('running');
    expect(world.score).toBe(0);
    expect(world.ships).toHaveLength(1);
    expect(player.pos).toEqual({ x: 512, y: 448 });
    expect(player.hp).toBe(100);
    expect(player.heading).toBeCloseTo(-Math.PI / 2);
  });

  it('converts degree-based settings to radians once, at snapshot time', () => {
    const world = createMatch(DEFAULT_GAME_CONFIG, 1);
    expect(world.angles.turnRate.player).toBeCloseTo((150 * Math.PI) / 180);
    expect(world.angles.shooterAimTolerance).toBeCloseTo((12 * Math.PI) / 180);
    expect(Object.isFrozen(world.angles)).toBe(true);
  });

  it('snapshots the config: later edits to the source do not leak into the match', () => {
    const cfg = configWith() as Mutable<GameConfig>;
    const world = createMatch(cfg, 1);
    cfg.match.sessionSeconds = 60;
    expect(world.cfg.match.sessionSeconds).toBe(120);
    expect(world.cfg).not.toBe(cfg);
    expect(Object.isFrozen(world.cfg.spawn.weights)).toBe(true);
  });

  it('rejects an invalid config with every issue listed', () => {
    const cfg = configWith((c) => {
      c.match.sessionSeconds = 10;
      c.projectile.radius = 0;
    });
    expect(() => createMatch(cfg, 1)).toThrow(InvalidMatchConfigError);
    expect(() => createMatch(cfg, 1)).toThrow(/match.sessionSeconds.*projectile.radius/);
  });

  it('rejects a player spawn on an island or outside the arena', () => {
    const onIsland = configWith((c) => {
      c.playerSpawn = { x: 300, y: 160, headingDeg: 0 };
    });
    const outside = configWith((c) => {
      c.playerSpawn = { x: 5, y: 300, headingDeg: 0 };
    });
    expect(() => createMatch(onIsland, 1)).toThrow(/playerSpawn/);
    expect(() => createMatch(outside, 1)).toThrow(/playerSpawn/);
  });

  it('restart = a brand-new, identical initial state', () => {
    expect(createMatch(DEFAULT_GAME_CONFIG, 9)).toEqual(createMatch(DEFAULT_GAME_CONFIG, 9));
  });
});

describe('damageStage', () => {
  const thresholds = DEFAULT_GAME_CONFIG.damage.stageThresholds;
  it.each([
    [100, 0],
    [67, 0],
    [66, 1],
    [34, 1],
    [33, 2],
    [1, 2],
    [0, 3],
  ])('hp %i/100 → stage %i', (hp, stage) => {
    expect(damageStage(hp, 100, thresholds)).toBe(stage);
  });
});
