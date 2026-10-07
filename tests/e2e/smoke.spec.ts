import { expect, test } from './fixtures/test';

test.describe('smoke', () => {
  test('boots the production bundle with the mock backend active', async ({ page, openApp }) => {
    await openApp();

    await expect(page.getByRole('heading', { level: 1, name: 'Pirate Battle' })).toBeVisible();

    const health = await page.evaluate(async () => {
      const response = await fetch('/api/health');
      return { status: response.status, body: await response.json() };
    });
    expect(health).toEqual({ status: 200, body: { status: 'ok' } });
  });
});
