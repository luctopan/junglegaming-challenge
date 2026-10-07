// @ts-check
/**
 * Visual review captures of the render sandbox (dev server only), for the
 * phase reports: `pnpm sandbox:shots [outDir]` (default docs/screenshots/phase2).
 * Starts its own Vite dev server, opens /sandbox.html per scene with query
 * params that make the frame reproducible (seed, stopAt, pauseOnExplosion…),
 * waits until the sandbox pauses itself, and saves desktop (1280×720) and
 * mobile landscape (Pixel 7) screenshots.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from '@playwright/test';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(root, process.argv[2] ?? 'docs/screenshots/phase2');
const PAUSE_TIMEOUT_MS = 90_000;
const JPEG_QUALITY = 85;

/**
 * @typedef {{ time: number, paused: boolean, enemies: number, projectiles: number,
 *   damagedShips: number, burningShips: number, effects: number }} SandboxState
 * @typedef {{ name: string, query: string }} Scene
 */

/** Player sails diagonally into the U island's top-left (convex) corner. */
const CORNER = 'seed=3&spawn=78,78,45&pilot=forward&stopAt=1.5';

/** @type {Scene[]} */
const SCENES = [
  { name: '01-match-start', query: 'seed=3&stopAt=0.5' },
  { name: '02-mid-fight', query: 'seed=5&speed=2&pauseOnFight=1' },
  { name: '03-explosion', query: 'seed=3&speed=2&pauseOnExplosion=1' },
  { name: '04-convex-corner', query: CORNER },
  { name: '05-convex-corner-collision', query: `${CORNER}&overlay=1` },
];

const VIEWPORTS = [
  { label: 'desktop', options: { viewport: { width: 1280, height: 720 } } },
  { label: 'mobile', options: devices['Pixel 7 landscape'] },
];

const server = await createServer({ root, logLevel: 'error', server: { port: 0 } });
await server.listen();
const address = server.httpServer?.address();
if (address === null || address === undefined || typeof address === 'string') {
  throw new Error('Vite dev server has no port');
}
const base = `http://localhost:${address.port}/sandbox.html`;
const browser = await chromium.launch();
mkdirSync(outDir, { recursive: true });
/** @type {string[]} */
const saved = [];

try {
  for (const { label, options } of VIEWPORTS) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    for (const scene of SCENES) {
      await page.goto(`${base}?${scene.query}&ui=0`);
      // Page-side code as strings: this script is typechecked without the DOM lib.
      await page.waitForFunction('window.__SANDBOX__?.state()?.paused === true', undefined, {
        timeout: PAUSE_TIMEOUT_MS,
      });
      // Two more frames so the paused frame is fully presented.
      await page.evaluate(
        'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))',
      );
      const state = /** @type {SandboxState} */ (await page.evaluate('window.__SANDBOX__.state()'));
      const file = path.join(outDir, `${label}-${scene.name}.jpg`);
      await page.screenshot({ path: file, type: 'jpeg', quality: JPEG_QUALITY });
      saved.push(`${path.relative(root, file)}  (${scene.query}, t=${state.time.toFixed(2)} s)`);
    }
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(saved.join('\n'));
