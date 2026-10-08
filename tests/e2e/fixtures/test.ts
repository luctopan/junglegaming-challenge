import { test as base, expect, type Page } from '@playwright/test';

/** Stable identity of the seeded test captain (a UUID v4, like a real player's). */
export const TEST_PLAYER_ID = '0b5e7a52-3c1d-4f7e-9a2b-6c8d0e1f2a3b';
export const PROFILE_KEY = 'pirate.profile.v1';
export const OPTIONS_KEY = 'pirate.options.v1';

interface AppFixtures {
  /**
   * Captain name seeded before the app loads, so game specs skip the first-Play
   * name dialog; null starts without a profile (captain dialog specs).
   */
  captainName: string | null;
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
  seedCaptain: undefined;
}

async function waitForMocks(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-msw', 'ready');
}

/** Minimal storage typing for page scripts (the e2e tsconfig has no DOM lib). */
interface PageStorage {
  localStorage: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
  };
}

export const test = base.extend<AppFixtures & Internal>({
  captainName: ['Test Captain', { option: true }],

  seedCaptain: [
    async ({ page, captainName }, use) => {
      if (captainName !== null) {
        // Only when absent: a reload keeps whatever the test did (e.g. a rename).
        await page.addInitScript(
          ({ key, profile }) => {
            const { localStorage } = globalThis as unknown as PageStorage;
            if (localStorage.getItem(key) === null) localStorage.setItem(key, profile);
          },
          {
            key: PROFILE_KEY,
            profile: JSON.stringify({ playerId: TEST_PLAYER_ID, name: captainName }),
          },
        );
      }
      await use(undefined);
    },
    { auto: true },
  ],

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

/**
 * Writes raw text into a storage key before the app's own scripts run
 * (corruption tests). Once per tab: a later reload sees what the app saved.
 */
export async function seedStorage(page: Page, key: string, raw: string): Promise<void> {
  await page.addInitScript(
    ({ key, raw }) => {
      const { localStorage, sessionStorage } = globalThis as unknown as PageStorage & {
        sessionStorage: PageStorage['localStorage'];
      };
      const marker = `e2e-seeded:${key}`;
      if (sessionStorage.getItem(marker) !== null) return;
      sessionStorage.setItem(marker, '1');
      localStorage.setItem(key, raw);
    },
    { key, raw },
  );
}

/** Parsed value of a storage key (null when absent). */
export async function readStorage(page: Page, key: string): Promise<unknown> {
  const raw = await page.evaluate(
    (storageKey) => (globalThis as unknown as PageStorage).localStorage.getItem(storageKey),
    key,
  );
  return raw === null ? null : (JSON.parse(raw) as unknown);
}

export { expect };

export const MOCK_DB_KEY = 'pirate.mockdb.v1';
export const PENDING_KEY = 'pirate.pending.v1';
export const LAST_RESULT_KEY = 'pirate.lastResult.v1';

/** A match of the seeded test captain, as submitted (`playedAt` fixed). */
export function testMatch(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    matchId: '7d1f3c2a-9b8e-4f6d-a5c4-3b2a1f0e9d8c',
    playerId: TEST_PLAYER_ID,
    playerName: 'Test Captain',
    playedAt: '2026-09-08T19:36:00.000Z',
    score: 24,
    durationMs: 120_000,
    endReason: 'time_up',
    config: { sessionSeconds: 120, spawnIntervalSeconds: 3 },
    ...overrides,
  };
}

/** Seeds confirmed records of the mock backend (as if registered by an earlier visit). */
export async function seedMockRecords(
  page: Page,
  matches: readonly Record<string, unknown>[],
): Promise<void> {
  const records = matches.map((match) => {
    const config = match.config as { sessionSeconds: number; spawnIntervalSeconds: number };
    return {
      ...match,
      configKey: `${config.sessionSeconds}s-${config.spawnIntervalSeconds}s`,
      recordedAt: match.playedAt,
    };
  });
  await seedStorage(page, MOCK_DB_KEY, JSON.stringify(records));
}

/** Mock HTTP failures are logged by the browser itself ("Failed to load resource"). */
export const NETWORK_FAILURE_LOG = /Failed to load resource|net::ERR_FAILED/;
