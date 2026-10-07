// @ts-check
/**
 * Visual review captures of every screen, for the phase report and the
 * mockup comparison (docs/DECISIONS.md): `pnpm ui:shots [outDir] [scene…]`
 * (default docs/screenshots/phase4, all scenes). Starts its own Vite dev
 * server and opens the app in test mode (`?test=1`, fixed seed, manual clock)
 * so every in-game capture is reproducible; saves desktop (1280×720) and
 * mobile landscape (Pixel 7) screenshots, plus portrait ones where relevant.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from '@playwright/test';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [outArg, ...only] = process.argv.slice(2);
const outDir = path.resolve(root, outArg ?? 'docs/screenshots/phase4');
const JPEG_QUALITY = 85;
const ARENA_TIMEOUT_MS = 30_000;
const CAPTAIN = { playerId: '0b5e7a52-3c1d-4f7e-9a2b-6c8d0e1f2a3b', name: 'Captain Jack' };

/**
 * @typedef {import('@playwright/test').Page} Page
 * @typedef {{ name: string, captain?: boolean, options?: object, query?: string,
 *   portrait?: boolean, run: (page: Page) => Promise<void> }} Scene
 */

/** @param {Page} page @param {number} ms */
const advance = (page, ms) =>
  page.evaluate(`(async () => { for (let t = 0; t < ${ms}; t += 1000) {
    window.__PIRATE_TEST__.advance(Math.min(1000, ${ms} - t));
    await new Promise((r) => setTimeout(r, 0)); } })()`);

/** @param {Page} page */
async function play(page) {
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.locator('[data-testid="arena"] canvas').waitFor({ timeout: ARENA_TIMEOUT_MS });
  await page.getByTestId('hud').waitFor();
}

/** @type {Scene[]} */
const SCENES = [
  { name: '01-menu', run: async () => {} },
  {
    name: '02-options',
    run: async (page) => {
      await page.getByRole('button', { name: 'Options', exact: true }).click();
    },
  },
  {
    name: '03-options-invalid',
    run: async (page) => {
      await page.getByRole('button', { name: 'Options', exact: true }).click();
      const field = page.getByRole('spinbutton', { name: 'Game session time' });
      await field.fill('75');
      await field.press('Enter');
    },
  },
  {
    name: '04-captain-dialog',
    captain: false,
    run: async (page) => {
      await page.getByRole('button', { name: 'Play', exact: true }).click();
      await page.getByRole('textbox', { name: 'Captain name' }).fill('J!');
      await page.keyboard.press('Enter');
    },
  },
  {
    name: '05-controls-dialog',
    run: async (page) => {
      await page.getByRole('button', { name: 'Controls' }).click();
    },
  },
  {
    name: '06-hud',
    run: async (page) => {
      await play(page);
      await page.keyboard.down('KeyW');
      await advance(page, 1500);
      await page.keyboard.up('KeyW');
      await advance(page, 7000);
      await page.keyboard.press('Space');
      await advance(page, 300);
    },
  },
  {
    name: '07-pause',
    run: async (page) => {
      await play(page);
      await advance(page, 4000);
      await page.getByRole('button', { name: 'Pause' }).click();
    },
  },
  {
    name: '08-pause-options',
    run: async (page) => {
      await play(page);
      await advance(page, 4000);
      await page.getByRole('button', { name: 'Pause' }).click();
      await page.getByRole('button', { name: 'Options' }).click();
    },
  },
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
const base = `http://localhost:${address.port}`;
const browser = await chromium.launch();
mkdirSync(outDir, { recursive: true });
/** @type {string[]} */
const saved = [];

try {
  for (const scene of SCENES.filter((s) => only.length === 0 || only.includes(s.name))) {
    const variants = scene.portrait
      ? [{ label: 'mobile-portrait', options: devices['Pixel 7'] }]
      : VIEWPORTS;
    for (const { label, options } of variants) {
      const context = await browser.newContext({ ...options, timezoneId: 'UTC', locale: 'en-US' });
      if (scene.captain !== false) {
        await context.addInitScript(
          (profile) => localStorage.setItem('pirate.profile.v1', profile),
          JSON.stringify(CAPTAIN),
        );
      }
      const page = await context.newPage();
      await page.goto(`${base}/?test=1&seed=5&clock=manual${scene.query ?? ''}`);
      await page.locator('html[data-msw="ready"]').waitFor();
      await scene.run(page);
      // Let images and fonts settle (no animation runs under the manual clock).
      await page.waitForTimeout(600);
      const file = path.join(outDir, `${label}-${scene.name}.jpg`);
      await page.screenshot({ path: file, type: 'jpeg', quality: JPEG_QUALITY });
      saved.push(path.relative(root, file));
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(saved.join('\n'));
