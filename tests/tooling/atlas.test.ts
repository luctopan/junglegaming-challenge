import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import {
  extrudeGrid,
  gridToPixi,
  readPngSize,
  sparrowToPixi,
  toJson,
} from '../../scripts/lib/atlas.mjs';

const assets = path.resolve(import.meta.dirname, '../../assets');
const read = (rel: string) => readFileSync(path.join(assets, rel));

describe('readPngSize', () => {
  it('reads the IHDR dimensions of the delivered sheets', () => {
    expect(readPngSize(read('tilesheet/tiles_sheet.png'))).toEqual({ w: 1024, h: 384 });
    expect(readPngSize(read('spritesheet/ships_miscellaneous_sheet.png'))).toEqual({
      w: 1024,
      h: 512,
    });
  });

  it('rejects non-PNG input', () => {
    expect(() => readPngSize(Buffer.from('not a png at all, definitely not'))).toThrow(
      'Not a PNG file',
    );
  });
});

describe('sparrowToPixi', () => {
  const size = { w: 64, h: 64 };

  it('converts untrimmed sub-textures and strips the .png suffix', () => {
    const xml = `<TextureAtlas imagePath="s.png">
      <SubTexture name="ship_1.png" x="1" y="2" width="30" height="40"/>
    </TextureAtlas>`;
    const atlas = sparrowToPixi(xml, { image: 'out.png', size });
    expect(atlas.frames).toEqual({
      ship_1: {
        frame: { x: 1, y: 2, w: 30, h: 40 },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: 30, h: 40 },
        sourceSize: { w: 30, h: 40 },
      },
    });
    expect(atlas.meta).toMatchObject({ image: 'out.png', size, scale: '1' });
  });

  it('sorts frames with natural numeric order for stable output', () => {
    const xml = ['ship_10', 'ship_2', 'ship_1']
      .map((n) => `<SubTexture name="${n}.png" x="0" y="0" width="1" height="1"/>`)
      .join('');
    expect(Object.keys(sparrowToPixi(xml, { image: 'x.png', size }).frames)).toEqual([
      'ship_1',
      'ship_2',
      'ship_10',
    ]);
  });

  it.each([
    ['trimmed frames', '<SubTexture name="a" x="0" y="0" width="1" height="1" frameX="-1"/>'],
    ['invalid numbers', '<SubTexture name="a" x="0" y="0" width="abc" height="1"/>'],
    ['missing names', '<SubTexture x="0" y="0" width="1" height="1"/>'],
    ['an empty atlas', '<TextureAtlas/>'],
  ])('rejects %s', (_label, xml) => {
    expect(() => sparrowToPixi(xml, { image: 'x.png', size })).toThrow();
  });

  it('rejects duplicate names', () => {
    const one = '<SubTexture name="a.png" x="0" y="0" width="1" height="1"/>';
    expect(() => sparrowToPixi(one + one, { image: 'x.png', size })).toThrow('Duplicate');
  });

  it('converts the delivered ship sheet', () => {
    const xml = read('spritesheet/ships_miscellaneous_sheet.xml').toString('utf8');
    const atlas = sparrowToPixi(xml, { image: 'ships_sheet.png', size: { w: 1024, h: 512 } });
    expect(Object.keys(atlas.frames)).toHaveLength(102);
    expect(atlas.frames.ship_1?.frame).toMatchObject({ w: 66, h: 113 });
    expect(atlas.frames.cannon_ball?.frame).toMatchObject({ w: 10, h: 10 });
  });
});

describe('gridToPixi', () => {
  it('numbers cells row-major from 1', () => {
    const atlas = gridToPixi({ image: 't.png', size: { w: 128, h: 128 }, tileSize: 64 });
    expect(Object.keys(atlas.frames)).toEqual(['tile_1', 'tile_2', 'tile_3', 'tile_4']);
    expect(atlas.frames.tile_3?.frame).toEqual({ x: 0, y: 64, w: 64, h: 64 });
  });

  it('rejects sheets that are not a whole number of tiles', () => {
    expect(() => gridToPixi({ image: 't.png', size: { w: 100, h: 64 }, tileSize: 64 })).toThrow();
  });

  it('offsets frames into a padded sheet', () => {
    const atlas = gridToPixi({ image: 't.png', size: { w: 128, h: 64 }, tileSize: 64, padding: 2 });
    expect(atlas.frames.tile_2?.frame).toEqual({ x: 70, y: 2, w: 64, h: 64 });
    expect(atlas.meta.size).toEqual({ w: 136, h: 68 });
  });

  // Guards the row-major assumption against the delivered art itself, through the
  // same extrusion the build applies.
  it.each([
    { sheet: 'tiles_sheet.png', dir: 'png/default/tiles', tileSize: 64, padding: 2 },
    { sheet: 'tiles_sheet_retina.png', dir: 'png/retina/tiles', tileSize: 128, padding: 4 },
  ])(
    'maps every tile_N.png onto its extruded $sheet cell pixel-exactly',
    ({ sheet, dir, tileSize, padding }) => {
      const source = PNG.sync.read(read(`tilesheet/${sheet}`));
      const png = extrudeGrid(source, tileSize, padding);
      const atlas = gridToPixi({
        image: sheet,
        size: { w: source.width, h: source.height },
        tileSize,
        padding,
      });
      expect(Object.keys(atlas.frames)).toHaveLength(96);
      expect(atlas.meta.size).toEqual({ w: png.width, h: png.height });

      for (const [name, { frame }] of Object.entries(atlas.frames)) {
        const tile = PNG.sync.read(read(`${dir}/${name}.png`));
        const cell = Buffer.alloc(frame.w * frame.h * 4);
        for (let y = 0; y < frame.h; y++) {
          const start = ((frame.y + y) * png.width + frame.x) * 4;
          cell.set(png.data.subarray(start, start + frame.w * 4), y * frame.w * 4);
        }
        expect(cell.equals(tile.data), name).toBe(true);
      }
    },
  );
});

describe('extrudeGrid', () => {
  it('surrounds each tile with copies of its own edge pixels', () => {
    // Two 2×2 tiles side by side: left tile all 10s, right tile all 200s.
    const data = new Uint8Array(4 * 2 * 4);
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 4; x++) data.fill(x < 2 ? 10 : 200, (y * 4 + x) * 4, (y * 4 + x) * 4 + 4);
    }
    const out = extrudeGrid({ width: 4, height: 2, data }, 2, 1);
    expect([out.width, out.height]).toEqual([8, 4]);
    const at = (x: number, y: number) => out.data[(y * out.width + x) * 4];
    // Padding of the left tile repeats the left tile, never the right one.
    expect([at(0, 0), at(3, 0), at(3, 3)]).toEqual([10, 10, 10]);
    expect([at(4, 0), at(7, 3)]).toEqual([200, 200]);
  });
});

describe('toJson', () => {
  it('is pretty-printed with a trailing newline', () => {
    expect(toJson({ a: 1 })).toBe('{\n  "a": 1\n}\n');
  });
});
