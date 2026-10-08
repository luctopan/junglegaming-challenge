import { setupWorker } from 'msw/browser';
import { createHandlers } from './handlers';

/** Attribute set on <html> once the worker intercepts requests; e2e tests wait for it. */
export const MOCKS_READY_ATTRIBUTE = 'data-msw';

/**
 * Starts the Mock Service Worker. Mocks are the app's backend in every build
 * (dev, tests and the public demo), so this must resolve before the first render.
 * `search` selects the network scenario (`?scenario=`) and latency seed (`?seed=`).
 */
export async function startMocking(search: string): Promise<void> {
  const worker = setupWorker(...createHandlers(search));
  await worker.start({
    onUnhandledFrame: 'bypass',
    quiet: import.meta.env.PROD,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  });
  document.documentElement.setAttribute(MOCKS_READY_ATTRIBUTE, 'ready');
}
