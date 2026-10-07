import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { playwrightImage } from '../../scripts/lib/playwright-image.mjs';

const root = path.resolve(import.meta.dirname, '../..');

describe('Playwright Docker image', () => {
  // Visual baselines are only stable if CI and `pnpm test:e2e:update` render with
  // the same browser build as the installed @playwright/test.
  it('CI uses the image matching the installed @playwright/test', () => {
    const workflow = readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
    const images = [...workflow.matchAll(/mcr\.microsoft\.com\/playwright:\S+/g)].map((m) => m[0]);
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) expect(image).toBe(playwrightImage(root));
  });
});
