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
 * Builds frames for a uniform grid sheet with no margin/spacing, numbered row-major
 * from 1 (`tile_1` is top-left), which is how the delivered `tile_N.png` files map
 * onto `tiles_sheet.png` (verified pixel by pixel in tests/tooling/atlas.test.ts).
 * @param {{ image: string, size: Size, tileSize: number, scale?: number, prefix?: string }} options
 * @returns {PixiAtlas}
 */
export function gridToPixi({ image, size, tileSize, scale = 1, prefix = 'tile_' }) {
  if (size.w % tileSize !== 0 || size.h % tileSize !== 0) {
    throw new Error(`Sheet ${size.w}x${size.h} is not a multiple of tile size ${tileSize}`);
  }
  const cols = size.w / tileSize;
  const rows = size.h / tileSize;
  /** @type {Record<string, PixiFrame>} */
  const frames = {};
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col + 1;
      frames[`${prefix}${index}`] = untrimmedFrame({
        x: col * tileSize,
        y: row * tileSize,
        w: tileSize,
        h: tileSize,
      });
    }
  }
  return atlas(frames, image, size, scale);
}

/**
 * Stable serialization so regenerated files are byte-identical.
 * @param {unknown} value
 */
export function toJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
