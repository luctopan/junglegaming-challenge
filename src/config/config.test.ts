import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG } from './defaults';
import type { GameConfig } from './gameConfig';
import {
  applyOptions,
  isWithinBounds,
  OPTION_BOUNDS,
  optionsFromConfig,
  parsePlayerOptions,
} from './options';
import { validateGameConfig } from './validate';

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };

const tweaked = (tweak: (cfg: Mutable<GameConfig>) => void): GameConfig => {
  const cfg = JSON.parse(JSON.stringify(DEFAULT_GAME_CONFIG)) as Mutable<GameConfig>;
  tweak(cfg);
  return cfg;
};

const issuePaths = (cfg: GameConfig): string[] => {
  const result = validateGameConfig(cfg);
  return result.ok ? [] : result.issues.map((i) => i.path);
};

describe('default config', () => {
  it('is valid and frozen', () => {
    expect(validateGameConfig(DEFAULT_GAME_CONFIG)).toEqual({ ok: true });
    expect(Object.isFrozen(DEFAULT_GAME_CONFIG.ships.player.hull)).toBe(true);
  });

  it('matches the documented option defaults', () => {
    expect(optionsFromConfig(DEFAULT_GAME_CONFIG)).toEqual({
      sessionSeconds: 120,
      spawnIntervalSeconds: 3,
    });
  });
});

describe('validateGameConfig', () => {
  it.each<[string, (cfg: Mutable<GameConfig>) => void]>([
    ['simulation.stepSeconds', (c) => (c.simulation.stepSeconds = 0)],
    ['simulation.maxFrameSeconds', (c) => (c.simulation.maxFrameSeconds = 0.001)],
    ['simulation.maxStepsPerFrame', (c) => (c.simulation.maxStepsPerFrame = 1.5)],
    ['match.sessionSeconds', (c) => (c.match.sessionSeconds = 59)],
    ['match.sessionSeconds', (c) => (c.match.sessionSeconds = 125)],
    ['arena.tileSize', (c) => (c.arena.tileSize = -1)],
    ['arena.islandCollisionInset', (c) => (c.arena.islandCollisionInset = 32)],
    ['ships.player.maxHp', (c) => (c.ships.player.maxHp = 0)],
    ['ships.chaser.maxSpeed', (c) => (c.ships.chaser.maxSpeed = Number.NaN)],
    ['ships.shooter.hull.circleOffset', (c) => (c.ships.shooter.hull.circleOffset = -1)],
    ['ships.chaser.hull.circleOffset', (c) => (c.ships.chaser.hull.circleOffset = 30)],
    ['playerSpawn.x', (c) => (c.playerSpawn.x = Number.POSITIVE_INFINITY)],
    ['weapons.front.cooldownSeconds', (c) => (c.weapons.front.cooldownSeconds = 0)],
    ['weapons.broadside.count', (c) => (c.weapons.broadside.count = 0)],
    ['weapons.broadside.spacing', (c) => (c.weapons.broadside.spacing = -2)],
    ['weapons.shooterCannon.projectileRange', (c) => (c.weapons.shooterCannon.projectileRange = 0)],
    ['projectile.radius', (c) => (c.projectile.radius = 0)],
    ['chaser.ramDamage', (c) => (c.chaser.ramDamage = 0)],
    ['shooter.standoffDistance', (c) => (c.shooter.standoffDistance = 400)],
    ['shooter.aimToleranceDeg', (c) => (c.shooter.aimToleranceDeg = 0)],
    ['ai.feelerAngleDeg', (c) => (c.ai.feelerAngleDeg = 90)],
    ['ai.minThrottle', (c) => (c.ai.minThrottle = 1.5)],
    ['collision.iterations', (c) => (c.collision.iterations = 0)],
    ['spawn.intervalSeconds', (c) => (c.spawn.intervalSeconds = 0)],
    ['spawn.intervalSeconds', (c) => (c.spawn.intervalSeconds = 1.25)],
    ['spawn.weights.chaser', (c) => (c.spawn.weights.chaser = -1)],
    ['spawn.maxAliveEnemies', (c) => (c.spawn.maxAliveEnemies = 0)],
    ['spawn.attemptsPerStep', (c) => (c.spawn.attemptsPerStep = 0)],
    ['damage.stageThresholds', (c) => (c.damage.stageThresholds = [1 / 3, 2 / 3])],
    ['damage.stageThresholds', (c) => (c.damage.stageThresholds = [1.2])],
    ['damage.wreckSeconds', (c) => (c.damage.wreckSeconds = -1)],
  ])('flags %s', (path, tweak) => {
    expect(issuePaths(tweaked(tweak))).toContain(path);
  });

  it('requires a positive total spawn weight', () => {
    const paths = issuePaths(
      tweaked((c) => {
        c.spawn.weights = { chaser: 0, shooter: 0 };
      }),
    );
    expect(paths).toEqual(['spawn.weights']);
  });

  it('reports every issue at once', () => {
    const paths = issuePaths(
      tweaked((c) => {
        c.projectile.radius = 0;
        c.chaser.ramDamage = 0;
      }),
    );
    expect(paths).toEqual(['projectile.radius', 'chaser.ramDamage']);
  });
});

describe('player options', () => {
  it('accepts values on the documented grid', () => {
    expect(isWithinBounds(60, OPTION_BOUNDS.sessionSeconds)).toBe(true);
    expect(isWithinBounds(180, OPTION_BOUNDS.sessionSeconds)).toBe(true);
    expect(isWithinBounds(65, OPTION_BOUNDS.sessionSeconds)).toBe(false);
    expect(isWithinBounds(190, OPTION_BOUNDS.sessionSeconds)).toBe(false);
    expect(isWithinBounds(1, OPTION_BOUNDS.spawnIntervalSeconds)).toBe(true);
    expect(isWithinBounds(9.5, OPTION_BOUNDS.spawnIntervalSeconds)).toBe(true);
    expect(isWithinBounds(0.5, OPTION_BOUNDS.spawnIntervalSeconds)).toBe(false);
    expect(isWithinBounds(Number.NaN, OPTION_BOUNDS.spawnIntervalSeconds)).toBe(false);
  });

  it('parses untrusted input with per-field errors', () => {
    expect(parsePlayerOptions({ sessionSeconds: 90, spawnIntervalSeconds: 2.5 })).toEqual({
      ok: true,
      options: { sessionSeconds: 90, spawnIntervalSeconds: 2.5 },
    });
    const bad = parsePlayerOptions({ sessionSeconds: '90', spawnIntervalSeconds: 0 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.errors.sessionSeconds).toMatch(/between 60 and 180/);
      expect(bad.errors.spawnIntervalSeconds).toMatch(/between 1 and 10/);
    }
    expect(parsePlayerOptions(null).ok).toBe(false);
  });

  it('applies options without touching the base config', () => {
    const cfg = applyOptions(DEFAULT_GAME_CONFIG, {
      sessionSeconds: 60,
      spawnIntervalSeconds: 1.5,
    });
    expect(cfg.match.sessionSeconds).toBe(60);
    expect(cfg.spawn.intervalSeconds).toBe(1.5);
    expect(cfg.spawn.weights).toEqual(DEFAULT_GAME_CONFIG.spawn.weights);
    expect(DEFAULT_GAME_CONFIG.match.sessionSeconds).toBe(120);
    expect(validateGameConfig(cfg)).toEqual({ ok: true });
  });
});
