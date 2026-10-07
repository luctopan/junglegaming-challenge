import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
/** Vite dev server: only for specs that need development-only React behaviour (Strict Mode). */
const DEV_PORT = 5174;
// Anchored on tests/e2e: a bare 'dev/**' glob would also match a checkout under a "dev" folder.
const DEV_SPECS = /tests[\\/]e2e[\\/]dev[\\/][^\\/]+\.spec\.ts$/;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'tests/e2e',
  // One baseline per project, no OS suffix: baselines are only produced in the
  // pinned Linux image (`pnpm test:e2e:update`), which CI also uses.
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{projectName}/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  ...(isCI ? { workers: 2 } : {}),
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    timezoneId: 'UTC',
    locale: 'en-US',
  },
  projects: [
    {
      name: 'desktop-chromium',
      testIgnore: DEV_SPECS,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
    {
      // Gameplay is landscape-only on mobile (docs/DECISIONS.md).
      name: 'mobile-chromium',
      testIgnore: DEV_SPECS,
      use: { ...devices['Pixel 7 landscape'] },
    },
    {
      // React Strict Mode double-mounts only in development builds.
      name: 'dev-strict-mode',
      testMatch: DEV_SPECS,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        baseURL: `http://localhost:${DEV_PORT}`,
      },
    },
  ],
  webServer: [
    {
      // Everything else runs against the production bundle, MSW included.
      command: 'pnpm e2e:serve',
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !isCI,
      timeout: 180_000,
    },
    {
      // No assets:build here: running it alongside e2e:serve would race on public/assets/,
      // and Playwright starts the tests only once both servers (and that build) are up.
      command: `pnpm e2e:dev --port ${DEV_PORT} --strictPort`,
      url: `http://localhost:${DEV_PORT}`,
      reuseExistingServer: !isCI,
      timeout: 180_000,
    },
  ],
});
