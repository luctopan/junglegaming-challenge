// @ts-check
/**
 * One-time offline tool: the ship vector (assets/vector/ships_miscellaneous_vector.svg)
 * has no per-sprite ids and uses the preview.png layout, not the sheet layout.
 * This script finds every 1× sheet frame inside a 2× rasterization of the
 * vector by template matching (coarse search on 4×-reduced images, then a
 * full-resolution refinement at half-pixel precision), and writes the
 * frame → rect mapping to scripts/data/ships-vector-frames.json, in vector
 * units (1×, multiples of 0.5). The asset build crops the 2× raster with it.
 *
 *   node scripts/locate-vector-frames.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { PNG } from 'pngjs';
import { sparrowToPixi, toJson } from './lib/atlas.mjs';
import { frameErrorAt } from './lib/vectorAtlas.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const asset = (/** @type {string} */ rel) => readFileSync(path.join(root, 'assets', rel));
const SCALE = 2;
const COARSE = 4; // reduction of the 1× images for the coarse search
/** Frames smaller than this (1× px) are searched at full 1× resolution: a few coarse cells cannot locate them. */
const SMALL_FRAME = 48;
const CANDIDATES = 12; // best coarse positions refined at full resolution
const REFINE = 3; // ± px (1×) around each coarse candidate
const TOLERANCE = 8;

/** @typedef {{ width: number, height: number, data: Uint8Array }} RgbaImage */

/**
 * Premultiplied box reduction by an integer factor, as Float32 RGBA.
 * @param {RgbaImage} image @param {number} factor
 */
function reduce(image, factor) {
  const width = Math.floor(image.width / factor);
  const height = Math.floor(image.height / factor);
  const data = new Float32Array(width * height * 4);
  const n = factor * factor;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          const i = ((y * factor + dy) * image.width + x * factor + dx) * 4;
          const a = (image.data[i + 3] ?? 0) / 255;
          for (let c = 0; c < 3; c++) {
            data[o + c] = (data[o + c] ?? 0) + ((image.data[i + c] ?? 0) * a) / n;
          }
          data[o + 3] = (data[o + 3] ?? 0) + (image.data[i + 3] ?? 0) / n;
        }
      }
    }
  }
  return { width, height, data };
}

const sheet = /** @type {RgbaImage} */ (
  PNG.sync.read(asset('spritesheet/ships_miscellaneous_sheet.png'))
);
const xml = asset('spritesheet/ships_miscellaneous_sheet.xml').toString('utf8');
const frames = sparrowToPixi(xml, {
  image: 'x.png',
  size: { w: sheet.width, h: sheet.height },
}).frames;
const raster = /** @type {RgbaImage} */ (
  PNG.sync.read(
    new Resvg(asset('vector/ships_miscellaneous_vector.svg'), {
      fitTo: { mode: 'zoom', value: SCALE },
    })
      .render()
      .asPng(),
  )
);
const levels = {
  [COARSE]: { vector: reduce(raster, SCALE * COARSE), sheet: reduce(sheet, COARSE) },
  1: { vector: reduce(raster, SCALE), sheet: reduce(sheet, 1) },
};

/** @type {Record<string, { x: number, y: number, w: number, h: number, error: number }>} */
const found = {};
/** @type {string[]} */
const failed = [];
for (const [name, { frame }] of Object.entries(frames)) {
  const COARSE_LEVEL = Math.max(frame.w, frame.h) < SMALL_FRAME ? 1 : COARSE;
  const { vector: coarseVector, sheet: coarseSheet } = levels[COARSE_LEVEL];
  // Coarse template: the frame inside the reduced sheet (whole cells only).
  const cx0 = Math.ceil(frame.x / COARSE_LEVEL);
  const cy0 = Math.ceil(frame.y / COARSE_LEVEL);
  const cw = Math.max(1, Math.floor((frame.x + frame.w) / COARSE_LEVEL) - cx0);
  const ch = Math.max(1, Math.floor((frame.y + frame.h) / COARSE_LEVEL) - cy0);
  /** @type {{ x: number, y: number, e: number }[]} */
  const best = [];
  for (let y = 0; y + ch <= coarseVector.height; y++) {
    for (let x = 0; x + cw <= coarseVector.width; x++) {
      let e = 0;
      for (let ty = 0; ty < ch && e < (best[CANDIDATES - 1]?.e ?? Infinity); ty++) {
        for (let tx = 0; tx < cw; tx++) {
          const v = ((y + ty) * coarseVector.width + x + tx) * 4;
          const s = ((cy0 + ty) * coarseSheet.width + cx0 + tx) * 4;
          for (let c = 0; c < 4; c++)
            e += Math.abs((coarseVector.data[v + c] ?? 0) - (coarseSheet.data[s + c] ?? 0));
        }
      }
      if (best.length < CANDIDATES || e < (best[CANDIDATES - 1]?.e ?? Infinity)) {
        best.push({ x, y, e });
        best.sort((a, b) => a.e - b.e);
        best.length = Math.min(best.length, CANDIDATES);
      }
    }
  }
  // Refine in 2× pixels (= half 1× pixels) around each candidate's implied frame origin.
  let winner = { x: 0, y: 0, error: Infinity };
  for (const c of best) {
    const ox = (c.x * COARSE_LEVEL - (cx0 * COARSE_LEVEL - frame.x)) * SCALE;
    const oy = (c.y * COARSE_LEVEL - (cy0 * COARSE_LEVEL - frame.y)) * SCALE;
    for (let dy = -REFINE * SCALE; dy <= REFINE * SCALE; dy++) {
      for (let dx = -REFINE * SCALE; dx <= REFINE * SCALE; dx++) {
        const error = frameErrorAt(sheet, raster, frame, SCALE, ox + dx, oy + dy);
        if (error < winner.error) winner = { x: ox + dx, y: oy + dy, error };
      }
    }
  }
  const rect = {
    x: winner.x / SCALE,
    y: winner.y / SCALE,
    w: frame.w,
    h: frame.h,
    error: winner.error,
  };
  if (rect.error > TOLERANCE) failed.push(`${name} (${rect.error.toFixed(1)})`);
  found[name] = rect;
}

console.log(
  `${Object.keys(frames).length - failed.length} of ${Object.keys(frames).length} frames located`,
);
if (failed.length > 0) console.log(`not found within tolerance ${TOLERANCE}: ${failed.join(', ')}`);
const out = path.join(root, 'scripts', 'data', 'ships-vector-frames.json');
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(
  out,
  toJson({
    source: 'assets/vector/ships_miscellaneous_vector.svg',
    units: 'vector px at 1x (top-left of each sheet frame)',
    tolerance: TOLERANCE,
    frames: Object.fromEntries(
      Object.entries(found)
        .filter(([, r]) => r.error <= TOLERANCE)
        .map(([n, r]) => [n, { x: r.x, y: r.y, error: Math.round(r.error * 10) / 10 }]),
    ),
    notLocated: Object.fromEntries(
      Object.entries(found)
        .filter(([, r]) => r.error > TOLERANCE)
        .map(([n, r]) => [n, { bestError: Math.round(r.error * 10) / 10 }]),
    ),
  }),
);
console.log(`Wrote ${path.relative(root, out)}`);
