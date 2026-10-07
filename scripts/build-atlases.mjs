// @ts-check
/**
 * Builds runtime assets into public/assets/ from the delivered assets/ folder:
 * - Pixi JSON for the ship sheet (from Sparrow XML) and the tile sheets (grid),
 * - a 2× ship sheet rasterized from the vector source and re-packed into the
 *   sheet layout (docs/DECISIONS.md R1), shipped only if every frame matches 1×,
 * - copies of the UI atlases, sounds and branding used at runtime,
 * - `manifest.json`: the Pixi asset bundle the game loads (1×/2× variants use the
 *   `@2x` suffix, so Pixi picks the resolution itself).
 * Idempotent and deterministic; the output is git-ignored and rebuilt by
 * `pnpm dev` / `pnpm build` (see docs/DECISIONS.md).
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { PNG } from 'pngjs';
import {
  extrudeGrid,
  gridToPixi,
  healSeams,
  readPngSize,
  scaleAtlas,
  sparrowToPixi,
  toJson,
} from './lib/atlas.mjs';
import { ISLAND_BLOCK_SEAMS } from './lib/islandBlock.mjs';
import { checkFrameAlignment, composeScaledSheet } from './lib/vectorAtlas.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'assets');
const out = path.join(root, 'public', 'assets');

const TILE_SIZE = 64;
/** Edge pixels repeated around each tile (× scale), against seams between adjacent tiles. */
const TILE_PADDING = 2;
/** Width (1× px, × scale) over which a border's colour step is faded out. */
const SEAM_HEAL_WIDTH = 8;

const RETINA = 2;
/** Mean per-channel difference (0–255) above which a vector frame does not match its raster frame. */
const VECTOR_FRAME_TOLERANCE = 8;
/** Frame positions inside the vector, found once by scripts/locate-vector-frames.mjs. */
const VECTOR_FRAME_MAP = path.join(root, 'scripts', 'data', 'ships-vector-frames.json');

/** @param {string} rel */
const source = (rel) => path.join(src, rel);

/** Every file this run writes; anything else left in `out` is stale and pruned at the end. */
const written = new Set();

/** @param {string} rel */
function target(rel) {
  const file = path.join(out, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  written.add(file);
  return file;
}

/**
 * Removes files of earlier builds that this run did not write. The output is
 * rebuilt in place instead of deleted up front: a dev server started at the
 * same time (the e2e web servers start in parallel) scans `public/` once and,
 * on file systems without change events (Docker bind mounts from Windows),
 * would otherwise keep serving a deleted file as the HTML fallback.
 */
function pruneStale() {
  for (const entry of readdirSync(out, { recursive: true, withFileTypes: true })) {
    const file = path.join(entry.parentPath, entry.name);
    if (entry.isFile() && !written.has(file)) rmSync(file);
  }
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
 * Rasterizes the vector source at 2× and re-packs it into the 1× sheet layout,
 * using the frame positions found once by `scripts/locate-vector-frames.mjs`
 * (the vector has the preview layout and no sprite ids). Frames it could not
 * locate are upscaled from 1×. The result ships only if every frame matches the
 * 1× sheet, which guards against a stale mapping or changed art.
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
  /** @type {{ frames: Record<string, { x: number, y: number }> }} */
  const mapping = existsSync(VECTOR_FRAME_MAP)
    ? JSON.parse(readFileSync(VECTOR_FRAME_MAP, 'utf8'))
    : { frames: {} };
  const { image: composed, upscaled } = composeScaledSheet({
    sheet,
    raster: scaled,
    frames,
    located: mapping.frames,
    scale: RETINA,
  });
  const fromVector = Object.keys(frames).length - upscaled.length;
  if (fromVector === 0) return { status: 'fallback', reason: 'no frame located in the vector' };
  const report = checkFrameAlignment({
    sheet,
    scaled: composed,
    frames,
    scale: RETINA,
    tolerance: VECTOR_FRAME_TOLERANCE,
  });
  if (!report.aligned) return { status: 'fallback', reason: report.reason };

  const image = 'ships_sheet@2x.png';
  const png = new PNG({ width: composed.width, height: composed.height });
  png.data = Buffer.from(composed.data);
  writeFileSync(target(`ships/${image}`), PNG.sync.write(png));
  const size = { w: composed.width, h: composed.height };
  writeFileSync(
    target('ships/ships_sheet@2x.json'),
    toJson(scaleAtlas(atlas, RETINA, image, size)),
  );
  const note =
    upscaled.length > 0 ? `, ${upscaled.length} upscaled from 1× (${upscaled.join(', ')})` : '';
  return {
    status: 'rasterized',
    reason: `${fromVector} frames from the vector${note}; ${report.reason}`,
  };
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
    healSeams(sheet, tileSize, ISLAND_BLOCK_SEAMS, SEAM_HEAL_WIDTH * scale);
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
pruneStale();
console.log(`Assets built into ${path.relative(root, out)}`);
console.log(`Ship sheet 2× from vector: ${ships.vector.status} (${ships.vector.reason})`);
