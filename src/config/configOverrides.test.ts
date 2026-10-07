import { describe, expect, it } from 'vitest';
import { applyConfigOverrides } from './configOverrides';
import { DEFAULT_GAME_CONFIG } from './defaults';

const apply = (query: string) =>
  applyConfigOverrides(DEFAULT_GAME_CONFIG, new URLSearchParams(query));

describe('applyConfigOverrides (dev-only URL balance overrides)', () => {
  it('sets nested numbers and leaves the base untouched', () => {
    const { config, applied, warnings } = apply(
      'cfg.ships.player.maxHp=150&cfg.weapons.shooterCannon.projectileSpeed=300',
    );
    expect(config.ships.player.maxHp).toBe(150);
    expect(config.weapons.shooterCannon.projectileSpeed).toBe(300);
    expect(applied).toEqual([
      'ships.player.maxHp=150',
      'weapons.shooterCannon.projectileSpeed=300',
    ]);
    expect(warnings).toEqual([]);
    expect(DEFAULT_GAME_CONFIG.ships.player.maxHp).toBe(200);
    expect(Object.isFrozen(config.ships.player)).toBe(true);
    // Untouched branches keep their values.
    expect(config.ships.chaser).toEqual(DEFAULT_GAME_CONFIG.ships.chaser);
  });

  it('ignores parameters without the cfg. prefix and returns the base itself', () => {
    const outcome = apply('test=1&seed=42');
    expect(outcome.config).toBe(DEFAULT_GAME_CONFIG);
    expect(outcome.warnings).toEqual([]);
  });

  it('rejects unknown paths, objects and non-numbers with a warning', () => {
    const { config, warnings } = apply(
      'cfg.ships.player.maxHP=150&cfg.ships.player=1&cfg.match.sessionSeconds=abc&cfg.match.sessionSeconds=',
    );
    expect(config).toBe(DEFAULT_GAME_CONFIG);
    expect(warnings).toEqual([
      'Ignoring cfg.ships.player.maxHP=150: unknown setting.',
      'Ignoring cfg.ships.player=1: not a number or boolean setting.',
      'Ignoring cfg.match.sessionSeconds=abc: not a finite number.',
      'Ignoring cfg.match.sessionSeconds=: not a finite number.',
    ]);
  });

  it('rejects values that make the config invalid, naming the rule', () => {
    const { config, warnings } = apply('cfg.ships.player.maxHp=-5&cfg.match.sessionSeconds=500');
    expect(config).toBe(DEFAULT_GAME_CONFIG);
    expect(warnings[0]).toBe(
      'Ignoring cfg.ships.player.maxHp=-5: ships.player.maxHp must be a finite number > 0.',
    );
    expect(warnings[1]).toContain('match.sessionSeconds Must be between 60 and 180');
  });

  it('parses booleans strictly', () => {
    expect(
      apply('cfg.spawn.guaranteeEachKindInFirstTwo=false').config.spawn.guaranteeEachKindInFirstTwo,
    ).toBe(false);
    expect(apply('cfg.spawn.guaranteeEachKindInFirstTwo=0').warnings[0]).toContain(
      'expected true or false',
    );
  });

  it('reaches array entries by index', () => {
    const { config } = apply('cfg.damage.stageThresholds.1=0.25');
    expect(config.damage.stageThresholds).toEqual([2 / 3, 0.25]);
    expect(apply('cfg.damage.stageThresholds.1=0.9').warnings[0]).toContain('strictly descending');
  });

  it('applies overrides in order, each against the config so far', () => {
    // Raising the range first makes the larger standoff valid.
    const ordered = apply('cfg.shooter.attackRange=400&cfg.shooter.standoffDistance=350');
    expect(ordered.config.shooter.standoffDistance).toBe(350);
    const reversed = apply('cfg.shooter.standoffDistance=350&cfg.shooter.attackRange=400');
    expect(reversed.config.shooter.standoffDistance).toBe(220);
    expect(reversed.warnings).toHaveLength(1);
  });
});
