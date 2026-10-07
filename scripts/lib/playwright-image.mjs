// @ts-check
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The pinned Playwright Docker image for the installed @playwright/test version.
 * Visual baselines are generated and checked only inside this image.
 * @param {string} root Repository root.
 * @returns {string}
 */
export function playwrightImage(root) {
  const pkgPath = path.join(root, 'node_modules', '@playwright', 'test', 'package.json');
  const { version } = /** @type {{ version: string }} */ (
    JSON.parse(readFileSync(pkgPath, 'utf8'))
  );
  return `mcr.microsoft.com/playwright:v${version}-noble`;
}
