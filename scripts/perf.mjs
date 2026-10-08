// @ts-check
/**
 * Performance evidence for docs/PERFORMANCE.md (spec §9): `pnpm perf [outFile]`.
 *
 * 1. Serves the production build (`dist/`, built by `pnpm perf`) with `vite preview`.
 * 2. Plays a 3-minute match (Options 180 s / 3 s) on the REAL clock in Chromium,
 *    driven by real keyboard input (sail, turn, fire). Frame times come from a
 *    requestAnimationFrame probe in the page; entity counts from the test hook
 *    snapshot once per second. If the ship sinks early, Play again continues the
 *    measurement until 180 s of combat are recorded (counted in `matches`).
 * 3. Runs 5 start/play/exit cycles and records the JS heap after a forced GC
 *    (CDP) plus the runtime resource counters after each exit.
 *
 * Headed by default so the GPU is used (`--headless` measures software WebGL).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const headless = args.includes('--headless');
// Installed Google Chrome by default (a stable, GPU-enabled Chromium); `--channel=chromium` for Playwright's.
const channel =
  args.find((a) => a.startsWith('--channel='))?.slice('--channel='.length) ?? 'chrome';
const outArg = args.find((a) => !a.startsWith('--'));
const outFile = path.resolve(root, outArg ?? 'docs/perf/perf-results.json');
const PORT = 4183;
const VIEWPORT = { width: 1280, height: 720 };
const COMBAT_SECONDS = 180;
const CYCLES = 5;
const CYCLE_PLAY_MS = 20_000;
const CAPTAIN = { playerId: '0b5e7a52-3c1d-4f7e-9a2b-6c8d0e1f2a3b', name: 'Perf Captain' };

/** @param {number[]} values @param {number} p */
const percentile = (values, p) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
};
const round = (/** @type {number} */ n, digits = 2) => Number(n.toFixed(digits));

const server = await preview({ root, preview: { port: PORT, strictPort: true } });
const browser = await chromium.launch({
  headless,
  channel,
  args: ['--ignore-gpu-blocklist', '--disable-background-timer-throttling'],
});
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
await context.addInitScript(
  ({ captain }) => {
    localStorage.setItem('pirate.profile.v1', JSON.stringify(captain));
    localStorage.setItem(
      'pirate.options.v1',
      JSON.stringify({ sessionSeconds: 180, spawnIntervalSeconds: 3 }),
    );
    localStorage.setItem('pirate.audio.v1', JSON.stringify({ muted: true }));
  },
  { captain: CAPTAIN },
);
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
const base = `http://localhost:${PORT}/?test=1&seed=42`;

/** @returns {Promise<any>} */
const hook = (/** @type {string} */ method) =>
  page.evaluate((m) => /** @type {any} */ (globalThis).__PIRATE_TEST__[m](), method);

async function openMenu() {
  await page.goto(base);
  await page.locator('html[data-msw="ready"]').waitFor();
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor();
}

async function startMatch() {
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByTestId('arena').locator('canvas').waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => {
    const snap = /** @type {any} */ (globalThis).__PIRATE_TEST__?.snapshot();
    return snap?.phase === 'running';
  });
}

/** Real keyboard input: always sailing, a turn every other second, firing constantly. */
function startPilot() {
  let tick = 0;
  let stopped = false;
  const loop = (async () => {
    await page.keyboard.down('KeyW');
    while (!stopped) {
      tick += 1;
      await page.keyboard.press('Space');
      if (tick % 6 === 0) await page.keyboard.press(tick % 12 === 0 ? 'KeyQ' : 'KeyE');
      if (tick % 7 === 0) await page.keyboard.down('KeyA');
      if (tick % 7 === 2) await page.keyboard.up('KeyA');
      await page.waitForTimeout(300);
    }
    await page.keyboard.up('KeyA');
    await page.keyboard.up('KeyW');
  })();
  return async () => {
    stopped = true;
    await loop;
  };
}

async function heapMb() {
  await cdp.send('HeapProfiler.collectGarbage');
  const { usedSize } = await cdp.send('Runtime.getHeapUsage');
  return round(usedSize / 1024 / 1024);
}

// ── 3-minute match ────────────────────────────────────────────────────────────
await openMenu();
const renderer = await page.evaluate(() => {
  const gl = /** @type {any} */ (globalThis).document.createElement('canvas').getContext('webgl');
  const info = gl?.getExtension('WEBGL_debug_renderer_info');
  return info && gl ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'unknown';
});
await startMatch();
await page.evaluate(() => {
  const w = /** @type {any} */ (globalThis);
  w.__perfFrames = [];
  let last = performance.now();
  const probe = (/** @type {number} */ now) => {
    w.__perfFrames.push(now - last);
    last = now;
    w.__perfRaf = w.requestAnimationFrame(probe);
  };
  w.__perfRaf = w.requestAnimationFrame(probe);
});
const stopPilot = startPilot();
/** @type {{ t: number, enemies: number, projectiles: number, displayObjects: number }[]} */
const samples = [];
let matches = 1;
let combatSeconds = 0;
let lastElapsed = 0;
while (combatSeconds < COMBAT_SECONDS) {
  await page.waitForTimeout(1000);
  const snap = await hook('snapshot');
  const res = await hook('resources');
  if (snap === null) continue;
  combatSeconds += Math.max(0, snap.elapsedSeconds - lastElapsed);
  lastElapsed = snap.elapsedSeconds;
  samples.push({
    t: round(combatSeconds, 1),
    enemies: snap.enemies.filter((/** @type {any} */ e) => e.alive).length,
    projectiles: snap.projectiles.length,
    displayObjects: res.displayObjects,
  });
  if (snap.phase === 'ended' && combatSeconds < COMBAT_SECONDS) {
    matches += 1;
    lastElapsed = 0;
    await page.getByRole('button', { name: 'Play again' }).click();
    await page.waitForFunction(
      () => /** @type {any} */ (globalThis).__PIRATE_TEST__?.snapshot()?.phase === 'running',
    );
  }
}
await stopPilot();
/** @type {number[]} */
const frames = await page.evaluate(() => {
  const w = /** @type {any} */ (globalThis);
  w.cancelAnimationFrame(w.__perfRaf);
  return w.__perfFrames.slice(1);
});
const totalMs = frames.reduce((sum, dt) => sum + dt, 0);
const match = {
  durationSeconds: round(totalMs / 1000, 1),
  combatSeconds: round(combatSeconds, 1),
  matches,
  frames: frames.length,
  averageFps: round((frames.length * 1000) / totalMs, 1),
  frameTimeMs: {
    mean: round(totalMs / frames.length),
    p50: round(percentile(frames, 50)),
    p95: round(percentile(frames, 95)),
    p99: round(percentile(frames, 99)),
    max: round(Math.max(...frames)),
  },
  framesOver20ms: frames.filter((dt) => dt > 20).length,
  entities: {
    maxEnemies: Math.max(...samples.map((s) => s.enemies)),
    maxProjectiles: Math.max(...samples.map((s) => s.projectiles)),
    maxDisplayObjects: Math.max(...samples.map((s) => s.displayObjects)),
    meanEnemies: round(samples.reduce((s, x) => s + x.enemies, 0) / samples.length, 1),
  },
  samples,
};
console.log('match', { ...match, samples: `${samples.length} samples` });

// ── 5 start/play/exit cycles ──────────────────────────────────────────────────
await openMenu();
const baselineHeap = await heapMb();
const cycles = [];
for (let cycle = 1; cycle <= CYCLES; cycle += 1) {
  await startMatch();
  const stop = startPilot();
  await page.waitForTimeout(CYCLE_PLAY_MS);
  await stop();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Main menu' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor();
  const res = await hook('resources');
  cycles.push({ cycle, heapMb: await heapMb(), resources: res });
  console.log('cycle', cycle, cycles.at(-1)?.heapMb, 'MB');
}

const result = {
  date: new Date().toISOString(),
  environment: {
    os: `${os.type()} ${os.release()} ${os.arch()}`,
    cpu: os.cpus()[0]?.model ?? 'unknown',
    cores: os.cpus().length,
    memoryGb: round(os.totalmem() / 1024 ** 3, 1),
    browser: `${channel === 'chrome' ? 'Google Chrome' : channel} ${browser.version()}${headless ? ' (headless)' : ' (headed)'}`,
    renderer,
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    build: 'production (vite build), served by vite preview',
    config: { sessionSeconds: 180, spawnIntervalSeconds: 3, seed: 42, clock: 'real' },
  },
  match,
  memory: { baselineHeapMb: baselineHeap, cycles },
};
mkdirSync(path.dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`);
console.log(`written ${path.relative(root, outFile)}`);
await browser.close();
await new Promise((resolve) => server.httpServer.close(resolve));
