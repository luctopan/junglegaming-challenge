import { test as base, expect, type Page } from '@playwright/test';

interface AppFixtures {
  /** Opens the app at `path` and waits until the mock backend intercepts requests. */
  openApp: (path?: string) => Promise<void>;
  /**
   * Declares a console error the test provokes on purpose (e.g. the browser's
   * own "Failed to load resource" for a request the test aborts).
   */
  allowConsoleError: (pattern: RegExp) => void;
  /** Console errors and uncaught exceptions collected for every test; any unexpected entry fails it. */
  consoleErrors: string[];
}

interface Internal {
  allowedConsoleErrors: RegExp[];
}

async function waitForMocks(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-msw', 'ready');
}

export const test = base.extend<AppFixtures & Internal>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixtures must destructure their dependencies.
  allowedConsoleErrors: async ({}, use) => {
    await use([]);
  },

  allowConsoleError: async ({ allowedConsoleErrors }, use) => {
    await use((pattern) => allowedConsoleErrors.push(pattern));
  },

  consoleErrors: [
    async ({ page, allowedConsoleErrors }, use) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));
      await use(errors);
      const unexpected = errors.filter((e) => !allowedConsoleErrors.some((p) => p.test(e)));
      expect(unexpected, 'console must stay free of errors').toEqual([]);
    },
    { auto: true },
  ],

  openApp: async ({ page }, use) => {
    await use(async (path = '/') => {
      await page.goto(path);
      await waitForMocks(page);
    });
  },
});

export { expect };
