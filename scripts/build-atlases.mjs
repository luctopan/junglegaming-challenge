// @ts-check
/**
 * Builds runtime assets into public/assets/ from the delivered assets/ folder:
 * - Pixi JSON for the ship sheet (from Sparrow XML) and the tile sheets (grid),
 * - a 2× ship sheet rasterized from the vector source, only if it lines up with
 *   the raster frames (otherwise 1× only; see docs/DECISIONS.md R1),
 * - copies of the UI atlases, sounds and branding used at runtime,
 * - `manifest.json`: the Pixi asset bundle the game loads (1×/2× variants use the
 *   `@2x` suffix, so Pixi picks the resolution itself).
 * Idempotent and deterministic; the output is git-ignored and rebuilt by
 * `pnpm dev` / `pnpm build` (see docs/DECISIONS.md).
 */
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { PNG } from 'pngjs';
import {
  extrudeGrid,
  gridToPixi,
  readPngSize,
  scaleAtlas,
  sparrowToPixi,
  toJson,
} from './lib/atlas.mjs';
import { checkFrameAlignment } from './lib/vectorAtlas.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'assets');
const out = path.join(root, 'public', 'assets');

const TILE_SIZE = 64;
/** Edge pixels repeated around each tile (× scale), against seams between adjacent tiles. */
const TILE_PADDING = 2;
const RETINA = 2;
/** Mean per-channel difference (0–255) above which a vector frame does not match its raster frame. */
const VECTOR_FRAME_TOLERANCE = 8;

/** @param {string} rel */
const source = (rel) => path.join(src, rel);

/** @param {string} rel */
function target(rel) {
  const file = path.join(out, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  return file;
}

/** @param {string} from @param {string} to */
const copy = (from, to) => {
  copyFileSync(source(from), target(to));
};

/**
 * @typedef {{ alias: string, src: string[] }} BundleAsset
 * @typedef {{ status: 'rasterized' | 'fallback', reason: string }} VectorShipsResult
 */

/** @returns {{ asset: BundleAsset, vector: VectorShipsResult }} */
function buildShips() {
  const png = 'spritesheet/ships_miscellaneous_sheet.png';
  const xml = readFileSync(source('spritesheet/ships_miscellaneous_sheet.xml'), 'utf8');
  const sheetBuffer = readFileSync(source(png));
  const atlas = sparrowToPixi(xml, { image: 'ships_sheet.png', size: readPngSize(sheetBuffer) });
  writeFileSync(target('ships/ships_sheet.json'), toJson(atlas));
  copy(png, 'ships/ships_sheet.png');
  // The delivered "retina" ship sheet has identical size and coordinates, so it is not shipped.

  const vector = rasterizeVectorShips(atlas, PNG.sync.read(sheetBuffer));
  const variants = ['ships/ships_sheet.json'];
  if (vector.status === 'rasterized') variants.push('ships/ships_sheet@2x.json');
  return { asset: { alias: 'ships', src: variants }, vector };
}

/**
 * Rasterizes the vector source at 2× and keeps it only if every frame matches the
 * 1× sheet at its XML coordinates (same art, same layout).
 * @param {import('./lib/atlas.mjs').PixiAtlas} atlas
 * @param {PNG} sheet
 * @returns {VectorShipsResult}
 */
function rasterizeVectorShips(atlas, sheet) {
  const svg = readFileSync(source('vector/ships_miscellaneous_vector.svg'));
  const raster = new Resvg(svg, { fitTo: { mode: 'zoom', value: RETINA } }).render();
  const scaled = PNG.sync.read(raster.asPng());
  const frames = Object.fromEntries(
    Object.entries(atlas.frames).map(([name, { frame }]) => [name, frame]),
  );
  const report = checkFrameAlignment({
    sheet,
    scaled,
    frames,
    scale: RETINA,
    tolerance: VECTOR_FRAME_TOLERANCE,
  });
  if (!report.aligned) return { status: 'fallback', reason: report.reason };

  const image = 'ships_sheet@2x.png';
  const size = { w: scaled.width, h: scaled.height };
  writeFileSync(target(`ships/${image}`), PNG.sync.write(scaled));
  writeFileSync(
    target('ships/ships_sheet@2x.json'),
    toJson(scaleAtlas(atlas, RETINA, image, size)),
  );
  return { status: 'rasterized', reason: report.reason };
}

/** @returns {BundleAsset} */
function buildTiles() {
  /** @type {string[]} */
  const variants = [];
  for (const { from, name, scale } of [
    { from: 'tiles_sheet.png', name: 'tiles_sheet', scale: 1 },
    { from: 'tiles_sheet_retina.png', name: `tiles_sheet@${RETINA}x`, scale: RETINA },
  ]) {
    const image = `${name}.png`;
    const sheet = PNG.sync.read(readFileSync(source(`tilesheet/${from}`)));
    const tileSize = TILE_SIZE * scale;
    const padding = TILE_PADDING * scale;
    const atlas = gridToPixi({
      image,
      size: { w: sheet.width, h: sheet.height },
      tileSize,
      scale,
      padding,
    });
    const extruded = extrudeGrid(sheet, tileSize, padding);
    const png = new PNG({ width: extruded.width, height: extruded.height });
    png.data = Buffer.from(extruded.data);
    writeFileSync(target(`tiles/${name}.json`), toJson(atlas));
    writeFileSync(target(`tiles/${image}`), PNG.sync.write(png));
    variants.push(`tiles/${name}.json`);
  }
  return { alias: 'tiles', src: variants };
}

/** @returns {BundleAsset} */
function copyUi() {
  /** @type {string[]} */
  const variants = [];
  // Already in Pixi format (extra `ui` metadata kept); only the image name changes.
  for (const { from, name } of [
    { from: 'ui_sheet', name: 'ui_sheet' },
    { from: 'ui_sheet_retina', name: `ui_sheet@${RETINA}x` },
  ]) {
    const json = JSON.parse(readFileSync(source(`spritesheet/${from}.json`), 'utf8'));
    json.meta.image = `${name}.png`;
    writeFileSync(target(`ui/${name}.json`), toJson(json));
    copy(`spritesheet/${from}.png`, `ui/${name}.png`);
    variants.push(`ui/${name}.json`);
  }
  return { alias: 'ui', src: variants };
}

function copySounds() {
  const wavs = readdirSync(source('sounds'))
    .filter((f) => f.endsWith('.wav'))
    .sort();
  for (const file of wavs) copy(`sounds/${file}`, `sounds/${file}`);
}

function copyBranding() {
  copy('logo_jungle_gaming.svg', 'branding/logo_jungle_gaming.svg');
  copy('ui_scene_background.png', 'branding/ui_scene_background.png');
}

rmSync(out, { recursive: true, force: true });
const ships = buildShips();
const tiles = buildTiles();
const ui = copyUi();
copySounds();
copyBranding();
writeFileSync(
  target('manifest.json'),
  toJson({
    bundles: [{ name: 'combat', assets: [ships.asset, tiles, ui] }],
    vectorShips: ships.vector,
  }),
);
console.log(`Assets built into ${path.relative(root, out)}`);
console.log(`Ship sheet 2× from vector: ${ships.vector.status} (${ships.vector.reason})`);
