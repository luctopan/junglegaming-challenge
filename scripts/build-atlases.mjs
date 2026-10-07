// @ts-check
/**
 * Builds runtime assets into public/assets/ from the delivered assets/ folder:
 * - Pixi JSON for the ship sheet (from Sparrow XML) and the tile sheets (grid),
 * - copies of the UI atlases, sounds and branding used at runtime.
 * Idempotent and deterministic; the output is git-ignored and rebuilt by
 * `pnpm dev` / `pnpm build` (see docs/DECISIONS.md).
 */
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gridToPixi, readPngSize, sparrowToPixi, toJson } from './lib/atlas.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'assets');
const out = path.join(root, 'public', 'assets');

const TILE_SIZE = 64;
const TILE_SHEETS = /** @type {const} */ ([
  { suffix: '', scale: 1 },
  { suffix: '_retina', scale: 2 },
]);

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

function buildShips() {
  const image = 'ships_sheet.png';
  const png = 'spritesheet/ships_miscellaneous_sheet.png';
  const xml = readFileSync(source('spritesheet/ships_miscellaneous_sheet.xml'), 'utf8');
  const atlas = sparrowToPixi(xml, { image, size: readPngSize(readFileSync(source(png))) });
  writeFileSync(target('ships/ships_sheet.json'), toJson(atlas));
  copy(png, `ships/${image}`);
  // The delivered "retina" ship sheet has identical size and coordinates, so it is not shipped.
}

function buildTiles() {
  for (const { suffix, scale } of TILE_SHEETS) {
    const image = `tiles_sheet${suffix}.png`;
    const png = `tilesheet/${image}`;
    const atlas = gridToPixi({
      image,
      size: readPngSize(readFileSync(source(png))),
      tileSize: TILE_SIZE * scale,
      scale,
    });
    writeFileSync(target(`tiles/tiles_sheet${suffix}.json`), toJson(atlas));
    copy(png, `tiles/${image}`);
  }
}

function copyUi() {
  // Already in Pixi format; meta.image points at the sibling PNG.
  for (const name of ['ui_sheet', 'ui_sheet_retina']) {
    copy(`spritesheet/${name}.json`, `ui/${name}.json`);
    copy(`spritesheet/${name}.png`, `ui/${name}.png`);
  }
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
buildShips();
buildTiles();
copyUi();
copySounds();
copyBranding();
console.log(`Assets built into ${path.relative(root, out)}`);
