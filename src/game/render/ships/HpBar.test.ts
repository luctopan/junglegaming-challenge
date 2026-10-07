import type { Sprite } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { resourceCounts } from '../../../platform/resourceCounters';
import { FAKE_FILL_LAYOUT, fakeAtlas } from '../testing.test-support';
import { HP_BARS } from '../theme';
import { HpBar } from './HpBar';
import { hpBarArt, hpBarPixels, hpFill, shipFrame } from './shipVisual';

const fillSprite = (bar: HpBar): Sprite => bar.view.children[1] as Sprite;

describe('HpBar', () => {
  it('clips the fill horizontally from the left by the HP ratio (ui.layout.fill_rect)', () => {
    const atlas = fakeAtlas();
    const bar = new HpBar(atlas);
    bar.bind(HP_BARS.enemy);
    const { x, w } = FAKE_FILL_LAYOUT.fillRect;

    bar.setRatio(1);
    expect(fillSprite(bar).texture.frame.width).toBe(x + w);
    bar.setRatio(0.5);
    expect(fillSprite(bar).texture.frame.width).toBe(x + w / 2);
    expect(fillSprite(bar).width).toBe(x + w / 2);
    bar.setRatio(0);
    expect(fillSprite(bar).visible).toBe(false);
    bar.destroy();
  });

  it('switches fill colours at the configured thresholds', () => {
    const atlas = fakeAtlas();
    const bar = new HpBar(atlas);
    bar.bind(HP_BARS.enemy);
    bar.setRatio(0.9);
    expect(atlas.requested).toContain('enemy_health_fill_green');
    expect(atlas.requested).not.toContain('enemy_health_fill_red');
    bar.setRatio(0.3);
    expect(atlas.requested).toContain('enemy_health_fill_red');
    bar.destroy();
  });

  it('is scaled to fit over a ship and centred on its anchor point', () => {
    const bar = new HpBar(fakeAtlas());
    bar.bind(HP_BARS.enemy);
    const SHIP_WIDTH = 66;
    expect(160 * bar.view.scale.x).toBeLessThanOrEqual(SHIP_WIDTH);
    expect(bar.view.pivot.x).toBe(80);
    bar.destroy();
  });

  it('counts its private clip texture as a dynamic resource until destroyed', () => {
    const before = resourceCounts().dynamicTextures;
    const bar = new HpBar(fakeAtlas());
    expect(resourceCounts().dynamicTextures).toBe(before + 1);
    bar.destroy();
    expect(resourceCounts().dynamicTextures).toBe(before);
  });
});

describe('ship visuals', () => {
  it('maps kind and damage stage to the atlas ship frames', () => {
    expect(shipFrame('player', 0)).toBe('ship_5');
    expect(shipFrame('chaser', 1)).toBe('ship_8');
    expect(shipFrame('shooter', 2)).toBe('ship_15');
    expect(shipFrame('shooter', 3)).toBe('ship_21');
    // Stages beyond the art clamp to the wreck.
    expect(shipFrame('player', 9)).toBe('ship_23');
  });

  it('uses green/amber/red for the player and green/red for enemies', () => {
    const player = hpBarArt('player');
    expect(hpFill(player, 0.8).frame).toBe('health_fill_green');
    expect(hpFill(player, 0.5).frame).toBe('health_fill_amber');
    expect(hpFill(player, 0.2).frame).toBe('health_fill_red');
    const enemy = hpBarArt('chaser');
    expect(hpFill(enemy, 0.41).frame).toBe('enemy_health_fill_green');
    expect(hpFill(enemy, 0.4).frame).toBe('enemy_health_fill_red');
  });

  it('quantises bar widths to whole pixels', () => {
    expect(hpBarPixels(0.333, 112)).toBe(37);
    expect(hpBarPixels(-1, 112)).toBe(0);
    expect(hpBarPixels(2, 112)).toBe(112);
  });
});
