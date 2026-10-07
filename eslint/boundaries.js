// @ts-check
import { layerBoundaries } from './rules/layer-boundaries.js';

/** Packages that tie code to a UI framework, renderer, network stack or mock layer. */
const FRAMEWORK_PACKAGES = [
  'react',
  'react-dom',
  'react-router',
  'pixi.js',
  '@pixi',
  'axios',
  '@tanstack',
  'msw',
];

const withoutPackages = (/** @type {string[]} */ ...allowed) =>
  FRAMEWORK_PACKAGES.filter((p) => !allowed.includes(p));

/**
 * Single source of truth for the layer dependency rules documented in
 * ARCHITECTURE.md. Files outside every layer (src/main.tsx) are the composition
 * root: they may import anything, and nothing may import them.
 * @type {Record<string, import('./rules/layer-boundaries.js').LayerSpec>}
 */
export const LAYERS = {
  shared: { dir: 'src/shared', imports: [], forbiddenPackages: FRAMEWORK_PACKAGES },
  platform: { dir: 'src/platform', imports: ['shared'], forbiddenPackages: FRAMEWORK_PACKAGES },
  config: { dir: 'src/config', imports: ['shared'], forbiddenPackages: FRAMEWORK_PACKAGES },
  core: {
    dir: 'src/game/core',
    imports: ['config', 'shared'],
    forbiddenPackages: FRAMEWORK_PACKAGES,
  },
  input: {
    dir: 'src/game/input',
    imports: ['core', 'config', 'shared', 'platform'],
    forbiddenPackages: FRAMEWORK_PACKAGES,
  },
  render: {
    dir: 'src/game/render',
    imports: ['core', 'config', 'shared', 'platform'],
    forbiddenPackages: withoutPackages('pixi.js', '@pixi'),
  },
  bridge: {
    dir: 'src/game/bridge',
    imports: ['core', 'shared'],
    forbiddenPackages: FRAMEWORK_PACKAGES,
  },
  runtime: {
    dir: 'src/game/runtime',
    imports: ['core', 'input', 'render', 'bridge', 'config', 'shared', 'platform'],
    forbiddenPackages: withoutPackages('pixi.js', '@pixi'),
  },
  api: {
    dir: 'src/api',
    imports: ['config', 'shared', 'platform'],
    forbiddenPackages: withoutPackages('react', 'axios', '@tanstack'),
  },
  mocks: {
    dir: 'src/mocks',
    imports: ['api', 'shared', 'platform'],
    forbiddenPackages: withoutPackages('msw'),
  },
  ui: {
    dir: 'src/ui',
    imports: ['runtime', 'bridge', 'api', 'config', 'shared', 'platform'],
    forbiddenPackages: withoutPackages('react', 'react-dom', 'react-router', '@tanstack'),
  },
};

/**
 * Flat-config block with only the boundary rule. Kept separate from the main
 * config so tests can lint probe sources without type information.
 * @type {import('eslint').Linter.Config[]}
 */
export const boundariesConfig = [
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { local: { rules: { 'layer-boundaries': layerBoundaries } } },
    rules: {
      'local/layer-boundaries': ['error', { sourceRoot: 'src', layers: LAYERS }],
    },
  },
];
