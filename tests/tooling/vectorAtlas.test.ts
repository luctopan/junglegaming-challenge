import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { scaleAtlas, sparrowToPixi } from '../../scripts/lib/atlas.mjs';
import { checkFrameAlignment, frameError } from '../../scripts/lib/vectorAtlas.mjs';

const assets = path.resolve(import.meta.dirname, '../../assets');
const read = (rel: string) => readFileSync(path.join(assets, rel));

interface Image {
  width: number;
  height: number;
  data: Uint8Array;
}

/** Deterministic opaque test pattern with a transparent border column. */
function pattern(width: number, height: number): Image {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data.set([(x * 37) % 256, (y * 53) % 256, ((x + y) * 19) % 256, x === 0 ? 0 : 255], i);
    }
  }
  return { width, height, data };
}

/** Nearest-neighbour upscale: a perfect `scale`× version of the same layout. */
function upscale(image: Image, scale: number, shiftX = 0): Image {
  const width = image.width * scale;
  const height = image.height * scale;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = Math.min(image.width - 1, Math.max(0, Math.floor((x - shiftX) / scale)));
      const from = (Math.floor(y / scale) * image.width + sx) * 4;
      data.set(image.data.subarray(from, from + 4), (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

const frames = { a: { x: 0, y: 0, w: 8, h: 8 }, b: { x: 8, y: 4, w: 8, h: 4 } };

describe('vector atlas alignment', () => {
  const sheet = pattern(16, 8);

  it('accepts a 2× rasterization of the same layout', () => {
    expect(frameError(sheet, upscale(sheet, 2), frames.a, 2)).toBe(0);
    const report = checkFrameAlignment({
      sheet,
      scaled: upscale(sheet, 2),
      frames,
      scale: 2,
      tolerance: 1,
    });
    expect(report).toMatchObject({ aligned: true, misaligned: 0, frames: 2 });
  });

  it('rejects frames that are shifted in the vector', () => {
    const report = checkFrameAlignment({
      sheet,
      scaled: upscale(sheet, 2, 6),
      frames,
      scale: 2,
      tolerance: 1,
    });
    expect(report.aligned).toBe(false);
    expect(report.misaligned).toBeGreaterThan(0);
  });

  it('rejects a rasterization of a different size even if frames happen to match', () => {
    const bigger = upscale(pattern(20, 8), 2);
    const report = checkFrameAlignment({ sheet, scaled: bigger, frames, scale: 2, tolerance: 999 });
    expect(report.aligned).toBe(false);
    expect(report.reason).toContain('expected 32×16');
  });

  /**
   * The decision the asset build takes for the delivered art (docs/DECISIONS.md R1):
   * the vector is a 1280×720 overview with a different layout than the 1024×512
   * sheet, so no frame lines up and the game ships the 1× ship sheet only.
   */
  it('falls back to 1× for the delivered ship vector', () => {
    const xml = read('spritesheet/ships_miscellaneous_sheet.xml').toString('utf8');
    const sheetPng = read('spritesheet/ships_miscellaneous_sheet.png');
    const sheet1x = PNG.sync.read(sheetPng);
    const atlas = sparrowToPixi(xml, {
      image: 'ships_sheet.png',
      size: { w: sheet1x.width, h: sheet1x.height },
    });
    const svg = read('vector/ships_miscellaneous_vector.svg');
    const scaled = PNG.sync.read(
      new Resvg(svg, { fitTo: { mode: 'zoom', value: 2 } }).render().asPng(),
    );
    const report = checkFrameAlignment({
      sheet: sheet1x,
      scaled,
      frames: Object.fromEntries(Object.entries(atlas.frames).map(([n, f]) => [n, f.frame])),
      scale: 2,
      tolerance: 8,
    });
    expect(report.aligned).toBe(false);
    expect(report.misaligned).toBe(102);
  });
});

describe('scaleAtlas', () => {
  it('multiplies frame rectangles and records the resolution', () => {
    const atlas = sparrowToPixi('<SubTexture name="a.png" x="2" y="3" width="4" height="5"/>', {
      image: 'a.png',
      size: { w: 16, h: 16 },
    });
    const scaled = scaleAtlas(atlas, 2, 'a@2x.png', { w: 32, h: 32 });
    expect(scaled.frames.a?.frame).toEqual({ x: 4, y: 6, w: 8, h: 10 });
    expect(scaled.frames.a?.sourceSize).toEqual({ w: 8, h: 10 });
    expect(scaled.meta).toMatchObject({ image: 'a@2x.png', size: { w: 32, h: 32 }, scale: '2' });
  });
});
