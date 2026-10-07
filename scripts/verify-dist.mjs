// @ts-check
/**
 * Fails the build if dev-only code reached dist/: the render sandbox
 * (sandbox.html, src/dev/**) and the scripted test bots must never ship.
 * Run by `pnpm build` after `vite build`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findDevOnlyCode } from './lib/devOnly.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

/** @param {string} dir @returns {string[]} */
function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

// Generated game assets are binary art/sound/JSON data, not code.
const files = listFiles(dist)
  .map((file) => path.relative(dist, file).split(path.sep).join('/'))
  .filter((file) => !file.startsWith('assets/'));
const findings = findDevOnlyCode(
  files.map((file) => ({
    file,
    content: /\.(js|mjs|html|map)$/.test(file) ? readFileSync(path.join(dist, file), 'utf8') : '',
  })),
);
if (findings.length > 0) {
  console.error('Dev-only code found in dist/:');
  for (const finding of findings) console.error(`  ${finding}`);
  process.exit(1);
}
console.log(`dist/ is free of dev-only code (${files.length} files checked)`);
