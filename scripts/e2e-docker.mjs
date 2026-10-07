// @ts-check
/**
 * Runs the Playwright suite inside the pinned Linux image so screenshots match CI
 * regardless of the host OS. Extra CLI args are forwarded to `playwright test`
 * (e.g. `pnpm test:e2e:update` passes `--update-snapshots`).
 *
 * - The repo is bind-mounted; an anonymous volume shadows node_modules so the
 *   host's (e.g. Windows) native binaries never leak into the Linux container.
 * - A named volume caches the pnpm store and corepack downloads between runs.
 * - `--cpus=<n>` (consumed here, not forwarded) caps the container's CPUs, e.g.
 *   `pnpm test:e2e:docker --cpus=2` reproduces the 2-vCPU GitHub runner of this
 *   private repository, where every game page's software WebGL competes for CPU.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { playwrightImage } from './lib/playwright-image.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_VOLUME = 'pirate-battle-e2e-cache';
const quote = (/** @type {string} */ arg) => `'${arg.replaceAll("'", "'\\''")}'`;

const CPUS_FLAG = /^--cpus=(\d+(?:\.\d+)?)$/;
const cliArgs = process.argv.slice(2);
const cpus = cliArgs.map((arg) => CPUS_FLAG.exec(arg)?.[1]).find((value) => value !== undefined);
const playwrightArgs = cliArgs
  .filter((arg) => !CPUS_FLAG.test(arg))
  .map(quote)
  .join(' ');
const script = [
  'corepack enable',
  'pnpm install --frozen-lockfile',
  `pnpm exec playwright test ${playwrightArgs}`,
].join(' && ');

const args = [
  'run',
  '--rm',
  '--init',
  '--ipc=host',
  ...(cpus === undefined ? [] : [`--cpus=${cpus}`]),
  '-e',
  'CI=1',
  '-e',
  'COREPACK_ENABLE_DOWNLOAD_PROMPT=0',
  '-e',
  'COREPACK_HOME=/cache/corepack',
  '-e',
  'npm_config_store_dir=/cache/pnpm-store',
  '-v',
  `${root}:/work`,
  '-v',
  '/work/node_modules',
  '-v',
  `${CACHE_VOLUME}:/cache`,
  '-w',
  '/work',
  playwrightImage(root),
  'sh',
  '-c',
  script,
];

console.log(
  `Running Playwright in ${playwrightImage(root)}${cpus === undefined ? '' : ` (${cpus} CPUs)`}`,
);
const result = spawnSync('docker', args, { stdio: 'inherit' });
if (result.error) {
  console.error('Could not run docker. Is Docker Desktop running?', result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
