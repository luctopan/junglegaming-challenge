import { describe, expect, it } from 'vitest';
import uiSheet from '../../../../assets/spritesheet/ui_sheet.json';
import uiSheetRetina from '../../../../assets/spritesheet/ui_sheet_retina.json';
import { AtlasFrameError, parseFillLayout } from './atlas';
import { AssetManifestError, parseCombatManifest } from './combatAssets';

const DELIVERED: Record<string, { frames: Record<string, unknown> }> = {
  'ui_sheet.json': uiSheet,
  'ui_sheet_retina.json': uiSheetRetina,
};

describe('parseFillLayout', () => {
  it.each(['ui_sheet.json', 'ui_sheet_retina.json'])(
    'reads the bar layouts of the delivered %s in 1× units',
    (file) => {
      const frames = DELIVERED[file]?.frames ?? {};
      expect(parseFillLayout(frames.enemy_health_frame, 'enemy_health_frame').fillRect).toEqual({
        x: 24,
        y: 12,
        w: 112,
        h: 15,
      });
      expect(parseFillLayout(frames.health_frame, 'health_frame').fillRect).toEqual({
        x: 30,
        y: 15,
        w: 196,
        h: 20,
      });
    },
  );

  it('rejects frames without a usable layout', () => {
    expect(() => parseFillLayout({ ui: {} }, 'x')).toThrow(AtlasFrameError);
    const vertical = { ui: { layout: { fill_rect: { x: 0, y: 0, w: 1, h: 1 }, clip_axis: 'y', clip_origin: 'left' } } };
    expect(() => parseFillLayout(vertical, 'x')).toThrow('unsupported clip mode');
  });
});

describe('parseCombatManifest', () => {
  const asset = (alias: string) => ({ alias, src: [`${alias}/${alias}.json`] });

  it('accepts the combat bundle with every required atlas', () => {
    const manifest = { bundles: [{ name: 'combat', assets: [asset('ships'), asset('tiles'), asset('ui')] }] };
    expect(parseCombatManifest(manifest).map((a) => a.alias)).toEqual(['ships', 'tiles', 'ui']);
  });

  it('rejects malformed or incomplete manifests', () => {
    expect(() => parseCombatManifest(null)).toThrow(AssetManifestError);
    expect(() => parseCombatManifest({ bundles: [{ name: 'combat', assets: [{ alias: 1 }] }] })).toThrow(
      AssetManifestError,
    );
    expect(() =>
      parseCombatManifest({ bundles: [{ name: 'combat', assets: [asset('ships')] }] }),
    ).toThrow('missing tiles, ui');
  });
});
