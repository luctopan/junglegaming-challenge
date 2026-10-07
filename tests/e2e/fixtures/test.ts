import { test as base, expect, type Page } from '@playwright/test';

interface AppFixtures {
  /** Opens the app at `path` and waits until the mock backend intercepts requests. */
  openApp: (path?: string) => Promise<void>;
  /** Console errors and uncaught exceptions collected for every test; any entry fails it. */
  consoleErrors: string[];
}

async function waitForMocks(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-msw', 'ready');
}

export const test = base.extend<AppFixtures>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));
      await use(errors);
      expect(errors, 'console must stay free of errors').toEqual([]);
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
