/**
 * Test mode (`?test=1`) exposes `window.__PIRATE_TEST__` for the e2e suite.
 * It is read once from the URL the page was opened with.
 */
export const isTestMode = (search: string): boolean =>
  new URLSearchParams(search).get('test') === '1';
