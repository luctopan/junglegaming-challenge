// @ts-check
/**
 * Pure helpers that turn the delivered sprite sheets into Pixi spritesheet JSON.
 * No file system access here so every function is unit-testable.
 */

/**
 * @typedef {{ w: number, h: number }} Size
 * @typedef {{ x: number, y: number, w: number, h: number }} Rect
 * @typedef {{
 *   frame: Rect,
 *   rotated: false,
 *   trimmed: false,
 *   spriteSourceSize: Rect,
 *   sourceSize: Size,
 * }} PixiFrame
 * @typedef {{
 *   frames: Record<string, PixiFrame>,
 *   meta: { app: string, image: string, format: 'RGBA8888', size: Size, scale: string },
 * }} PixiAtlas
 */

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GENERATOR = 'pirate-battle scripts/build-atlases.mjs';

/**
 * Reads width/height from the IHDR chunk, which the PNG spec requires to come first.
 * @param {Buffer} buffer
 * @returns {Size}
 */
export function readPngSize(buffer) {
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Not a PNG file');
  }
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error('PNG is missing the IHDR chunk');
  }
  return { w: buffer.readUInt32BE(16), h: buffer.readUInt32BE(20) };
}

/**
 * @param {Rect} rect
 * @returns {PixiFrame}
 */
function untrimmedFrame(rect) {
  return {
    frame: rect,
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: rect.w, h: rect.h },
    sourceSize: { w: rect.w, h: rect.h },
  };
}

/**
 * @param {Record<string, PixiFrame>} frames
 * @param {string} image
 * @param {Size} size
 * @param {number} scale
 * @returns {PixiAtlas}
 */
function atlas(frames, image, size, scale) {
  const sorted = Object.fromEntries(
    Object.entries(frames).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })),
  );
  return {
    frames: sorted,
    meta: { app: GENERATOR, image, format: 'RGBA8888', size, scale: String(scale) },
  };
}

const SUBTEXTURE = /<SubTexture\b([^>]*?)\/?>/g;
const ATTRIBUTE = /(\w+)="([^"]*)"/g;

/**
 * @param {string} attributes
 * @returns {Record<string, string>}
 */
function parseAttributes(attributes) {
  /** @type {Record<string, string>} */
  const result = {};
  for (const match of attributes.matchAll(ATTRIBUTE)) {
    const [, key, value] = match;
    if (key !== undefined && value !== undefined) result[key] = value;
  }
  return result;
}

/**
 * Converts a Starling/Sparrow `<TextureAtlas>` (untrimmed sub-textures only) to Pixi JSON.
 * Frame names drop the `.png` suffix to match the UI atlas naming.
 * @param {string} xml
 * @param {{ image: string, size: Size, scale?: number }} options
 * @returns {PixiAtlas}
 */
export function sparrowToPixi(xml, { image, size, scale = 1 }) {
  /** @type {Record<string, PixiFrame>} */
  const frames = {};
  for (const match of xml.matchAll(SUBTEXTURE)) {
    const raw = match[1] ?? '';
    const attrs = parseAttributes(raw);
    if ('frameX' in attrs || 'rotated' in attrs) {
      throw new Error(`Trimmed or rotated sub-textures are not supported: ${raw.trim()}`);
    }
    const name = (attrs['name'] ?? '').replace(/\.png$/, '');
    const rect = {
      x: Number(attrs['x']),
      y: Number(attrs['y']),
      w: Number(attrs['width']),
      h: Number(attrs['height']),
    };
    if (name === '' || Object.values(rect).some((v) => !Number.isInteger(v) || v < 0)) {
      throw new Error(`Invalid SubTexture: ${raw.trim()}`);
    }
    if (name in frames) throw new Error(`Duplicate SubTexture name: ${name}`);
    frames[name] = untrimmedFrame(rect);
  }
  if (Object.keys(frames).length === 0) throw new Error('No SubTexture found');
  return atlas(frames, image, size, scale);
}

/**
 * Builds frames for a uniform grid sheet, numbered row-major from 1 (`tile_1` is
 * top-left), which is how the delivered `tile_N.png` files map onto
 * `tiles_sheet.png` (verified pixel by pixel in tests/tooling/atlas.test.ts).
 * `size` is the size of the grid as delivered (no margin/spacing); with
 * `padding`, frames point into a sheet made by `extrudeGrid` with that padding.
 * @param {{ image: string, size: Size, tileSize: number, scale?: number, prefix?: string, padding?: number }} options
 * @returns {PixiAtlas}
 */
export function gridToPixi({ image, size, tileSize, scale = 1, prefix = 'tile_', padding = 0 }) {
  if (size.w % tileSize !== 0 || size.h % tileSize !== 0) {
    throw new Error(`Sheet ${size.w}x${size.h} is not a multiple of tile size ${tileSize}`);
  }
  const cols = size.w / tileSize;
  const rows = size.h / tileSize;
  const cell = tileSize + 2 * padding;
  /** @type {Record<string, PixiFrame>} */
  const frames = {};
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col + 1;
      frames[`${prefix}${index}`] = untrimmedFrame({
        x: col * cell + padding,
        y: row * cell + padding,
        w: tileSize,
        h: tileSize,
      });
    }
  }
  return atlas(frames, image, { w: cols * cell, h: rows * cell }, scale);
}

/**
 * @typedef {{ width: number, height: number, data: Uint8Array }} RgbaImage
 */

/**
 * Re-packs a grid sheet with `padding` pixels around every tile, filled by
 * repeating the tile's own edge pixels. Without it, linear filtering at
 * non-integer scales samples the neighbouring tile of the sheet and draws
 * visible seams between adjacent tiles.
 * @param {RgbaImage} sheet
 * @param {number} tileSize
 * @param {number} padding
 * @returns {RgbaImage}
 */
export function extrudeGrid(sheet, tileSize, padding) {
  const cols = sheet.width / tileSize;
  const rows = sheet.height / tileSize;
  const cell = tileSize + 2 * padding;
  const width = cols * cell;
  const height = rows * cell;
  const data = new Uint8Array(width * height * 4);
  const clamp = (/** @type {number} */ v) => Math.min(tileSize - 1, Math.max(0, v));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      for (let y = 0; y < cell; y++) {
        for (let x = 0; x < cell; x++) {
          const sx = col * tileSize + clamp(x - padding);
          const sy = row * tileSize + clamp(y - padding);
          const from = (sy * sheet.width + sx) * 4;
          const to = ((row * cell + y) * width + col * cell + x) * 4;
          data.set(sheet.data.subarray(from, from + 4), to);
        }
      }
    }
  }
  return { width, height, data };
}

/**
 * The same frames on a sheet `factor` times larger (e.g. a 2× rasterization of
 * the same layout); `meta.scale` tells Pixi the textures' resolution.
 * @param {PixiAtlas} atlas
 * @param {number} factor
 * @param {string} image
 * @param {Size} size
 * @returns {PixiAtlas}
 */
export function scaleAtlas(atlas, factor, image, size) {
  /** @type {Record<string, PixiFrame>} */
  const frames = {};
  for (const [name, { frame }] of Object.entries(atlas.frames)) {
    frames[name] = untrimmedFrame({
      x: frame.x * factor,
      y: frame.y * factor,
      w: frame.w * factor,
      h: frame.h * factor,
    });
  }
  return { frames, meta: { ...atlas.meta, image, size, scale: String(factor) } };
}

/**
 * Stable serialization so regenerated files are byte-identical.
 * @param {unknown} value
 */
export function toJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * Removes the colour step along the shared border of two tiles that are always
 * drawn next to each other (`a` left of / above `b`), in place: each border
 * pixel pair moves to its midpoint, with the correction fading out over `width`
 * pixels into both tiles. Detail is kept; only the step disappears. Only pixels
 * that are opaque on both sides are touched (the transparent shore is left alone).
 * @param {RgbaImage} sheet Grid sheet, `tile_N` row-major from 1.
 * @param {number} tileSize
 * @param {{ a: number, b: number, axis: 'x' | 'y' }[]} pairs `axis: 'x'` = a|b side by side.
 * @param {number} width
 */
export function healSeams(sheet, tileSize, pairs, width) {
  const cols = sheet.width / tileSize;
  const OPAQUE = 250;
  /** @param {number} id @param {number} x @param {number} y */
  const index = (id, x, y) => {
    const col = (id - 1) % cols;
    const row = Math.floor((id - 1) / cols);
    return ((row * tileSize + y) * sheet.width + col * tileSize + x) * 4;
  };
  const original = new Uint8Array(sheet.data);
  for (const { a, b, axis } of pairs) {
    for (let along = 0; along < tileSize; along++) {
      // Border pixels of a and b, and the step to cancel.
      const last = tileSize - 1;
      const pa = axis === 'x' ? index(a, last, along) : index(a, along, last);
      const pb = axis === 'x' ? index(b, 0, along) : index(b, along, 0);
      if ((original[pa + 3] ?? 0) < OPAQUE || (original[pb + 3] ?? 0) < OPAQUE) continue;
      for (let c = 0; c < 3; c++) {
        const half = ((original[pb + c] ?? 0) - (original[pa + c] ?? 0)) / 2;
        for (let i = 0; i < width; i++) {
          const fade = 1 - i / width;
          const ia = axis === 'x' ? index(a, last - i, along) : index(a, along, last - i);
          const ib = axis === 'x' ? index(b, i, along) : index(b, along, i);
          if ((original[ia + 3] ?? 0) >= OPAQUE) {
            sheet.data[ia + c] = Math.round(
              Math.min(255, Math.max(0, (sheet.data[ia + c] ?? 0) + half * fade)),
            );
          }
          if ((original[ib + 3] ?? 0) >= OPAQUE) {
            sheet.data[ib + c] = Math.round(
              Math.min(255, Math.max(0, (sheet.data[ib + c] ?? 0) - half * fade)),
            );
          }
        }
      }
    }
  }
}
