import path from 'node:path';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import { boundariesConfig } from '../../eslint/boundaries.js';

const cwd = path.resolve(import.meta.dirname, '../..');

const eslint = new ESLint({
  cwd,
  overrideConfigFile: true,
  overrideConfig: [
    { files: ['**/*.{ts,tsx}'], languageOptions: { parser: tseslint.parser } },
    ...boundariesConfig,
  ],
});

/** Lints a probe source as if it lived at `file`; the file does not need to exist. */
async function boundaryErrors(file: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: path.join(cwd, file) });
  return (result?.messages ?? []).map((m) => `${m.ruleId ?? 'parse'}: ${m.message}`);
}

describe('layer boundaries', () => {
  it.each([
    ['src/game/core/probe.ts', "import { Application } from 'pixi.js';", 'pixi.js'],
    ['src/game/core/probe.ts', "import { useState } from 'react';", "package 'react'"],
    ['src/game/core/probe.ts', "import { view } from '../render/view';", "layer 'render'"],
    ['src/game/core/probe.ts', "import { storage } from '../../platform/storage';", "'platform'"],
    ['src/config/probe.ts', "import { storage } from '../platform/storage';", "'platform'"],
    ['src/shared/probe.ts', "import { x } from '../config/x';", "layer 'config'"],
    ['src/ui/probe.tsx', "import { step } from '../game/core/step';", "layer 'core'"],
    ['src/ui/probe.tsx', "import { Sprite } from 'pixi.js';", 'pixi.js'],
    ['src/ui/probe.tsx', "import { App } from '../main';", 'outside every layer'],
    ['src/game/render/probe.ts', "import { App } from '../../ui/app/App';", "layer 'ui'"],
    ['src/api/probe.ts', "export * from '../mocks/handlers';", "layer 'mocks'"],
    ['src/game/core/probe.ts', "const m = await import('../runtime/session');", "'runtime'"],
    // Scripted bots/test helpers must never reach the app bundle.
    ['src/game/core/index.ts', "export * from './testing/bots';", "'coreTesting' is test support"],
    ['src/game/core/step.ts', "import { run } from './testing/fixtures';", 'test support'],
    [
      'src/ui/probe.tsx',
      "import { BOT_PROFILES } from '../game/core/testing/bots';",
      'test support',
    ],
    ['src/game/core/testing/probe.ts', "import { Sprite } from 'pixi.js';", 'pixi.js'],
  ])('%s: rejects `%s`', async (file, code, expected) => {
    const errors = await boundaryErrors(file, code);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('local/layer-boundaries');
    expect(errors[0]).toContain(expected);
  });

  it.each([
    ['src/game/core/probe.ts', "import { cfg } from '../../config/defaults';"],
    ['src/game/core/probe.ts', "import { rng } from '../../shared/rng';"],
    ['src/game/core/systems/probe.ts', "import { world } from '../world';"],
    ['src/game/render/probe.ts', "import { Application } from 'pixi.js';"],
    ['src/ui/probe.tsx', "import { useState } from 'react';"],
    ['src/ui/probe.tsx', "import { store } from '../game/bridge/store';"],
    ['src/api/probe.ts', "import { storage } from '../platform/storage';"],
    ['src/mocks/probe.ts', "import { http } from 'msw';"],
    ['src/main.tsx', "import { anything } from './game/core';"],
    ['src/game/core/step.test.ts', "import { run } from './testing/fixtures';"],
    ['src/game/core/systems/ai.test.ts', "import { place } from '../testing/fixtures';"],
    ['src/game/core/testing/probe.ts', "import { step } from '../step';"],
    [
      'src/game/core/testing/probe.ts',
      "import { DEFAULT_GAME_CONFIG } from '../../../config/defaults';",
    ],
  ])('%s: allows `%s`', async (file, code) => {
    expect(await boundaryErrors(file, code)).toEqual([]);
  });
});
