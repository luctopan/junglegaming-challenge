import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG } from '../../config/defaults';
import { cloneDeepFrozen } from '../../shared/deepFreeze';
import type { DomainEvent, World } from '../core';
import { createMatch, step } from '../core';
import { skilledBotInput } from '../core/testing/skilledBot';
import { fakeAtlases } from './testing.test-support';
import { fitViewport } from './viewport';
import { WorldRenderer } from './WorldRenderer';

const STEP = DEFAULT_GAME_CONFIG.simulation.stepSeconds;

/** Plays `seconds` of a match with the skilled bot, collecting every event. */
function play(seconds: number, seed = 7): { world: World; events: DomainEvent[] } {
  const world = createMatch(DEFAULT_GAME_CONFIG, seed);
  const events: DomainEvent[] = [];
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) events.push(...step(world, skilledBotInput(world)));
  return { world, events };
}

function createRenderer() {
  const atlases = fakeAtlases();
  const world = createMatch(DEFAULT_GAME_CONFIG, 1);
  const renderer = new WorldRenderer(atlases, world.arena);
  renderer.setViewport(fitViewport({ width: 1280, height: 720 }, world.arena));
  return { renderer, atlases };
}

describe('WorldRenderer', () => {
  it('renders a deep-frozen world without writing to it (render reads, never decides)', () => {
    const { world, events } = play(20);
    const frozen = cloneDeepFrozen(world);
    const before = JSON.stringify(frozen);
    const { renderer } = createRenderer();

    // Any write to the frozen world would throw in strict-mode module code.
    expect(() => {
      renderer.playEvents(events, frozen);
      renderer.update(0.1);
      renderer.sync(frozen, 0.5);
      renderer.sync(frozen, 1);
    }).not.toThrow();
    expect(JSON.stringify(frozen)).toBe(before);
  });

  it('keeps one view per ship and per live projectile', () => {
    const { world } = play(12);
    const { renderer } = createRenderer();
    renderer.sync(world, 0);
    expect(renderer.stats.shipViews).toBe(world.ships.length);
    expect(renderer.stats.projectileViews).toBe(world.projectiles.filter((p) => p.alive).length);
    expect(world.ships.length).toBeGreaterThan(1);
  });

  it('releases views of removed entities and reuses them from the pool', () => {
    const { renderer } = createRenderer();
    const world = createMatch(DEFAULT_GAME_CONFIG, 3);
    let maxViews = 0;
    for (let i = 0; i < Math.round(40 / STEP); i++) {
      step(world, skilledBotInput(world));
      if (i % 6 === 0) {
        renderer.sync(world, 1);
        maxViews = Math.max(maxViews, renderer.stats.shipViews);
        expect(renderer.stats.shipViews).toBe(world.ships.length);
      }
    }
    renderer.reset();
    expect(renderer.stats).toEqual({ shipViews: 0, projectileViews: 0, effects: 0 });
    renderer.sync(createMatch(DEFAULT_GAME_CONFIG, 4), 1);
    expect(renderer.stats.shipViews).toBe(1);
    expect(maxViews).toBeGreaterThan(1);
  });

  it('plays pooled effects for combat events and lets them finish', () => {
    const { world, events } = play(15);
    const { renderer, atlases } = createRenderer();
    renderer.sync(world, 1);
    renderer.playEvents(events, world);
    expect(renderer.stats.effects).toBeGreaterThan(0);
    expect(atlases.ships.requested).toContain('explosion_3');
    // Every effect is shorter than a second.
    for (let i = 0; i < 20; i++) renderer.update(0.1);
    expect(renderer.stats.effects).toBe(0);
  });

  it('shows ships at their damage stage and wrecks with the wreck art', () => {
    const { renderer, atlases } = createRenderer();
    const world = createMatch(DEFAULT_GAME_CONFIG, 1);
    const player = world.ships[0];
    if (player === undefined) throw new Error('no player');
    player.hp = player.maxHp * 0.5;
    renderer.sync(world, 1);
    expect(atlases.ships.requested).toContain('ship_11'); // blue, stage 1
    player.hp = 0;
    player.alive = false;
    renderer.sync(world, 1);
    expect(atlases.ships.requested).toContain('ship_23'); // blue wreck
  });

  it('draws the arena from the tile atlas and HP bars from the UI atlas', () => {
    const { renderer, atlases } = createRenderer();
    renderer.sync(createMatch(DEFAULT_GAME_CONFIG, 1), 1);
    expect(atlases.tiles.requested).toContain('tile_73');
    expect(atlases.tiles.requested).toContain('tile_27');
    expect(atlases.ui.requested).toContain('health_frame');
  });

  it('destroys every display object it created', () => {
    const { renderer } = createRenderer();
    const { world, events } = play(10);
    renderer.sync(world, 1);
    renderer.playEvents(events, world);
    renderer.destroy();
    expect(renderer.root.destroyed).toBe(true);
  });
});
