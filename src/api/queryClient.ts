import { QueryClient } from '@tanstack/react-query';
import { isRetryable } from './errors';

const MAX_RETRIES = 2;
const RETRY_BASE_MS = 500;
const RETRY_CAP_MS = 4000;
const STALE_MS = 15_000;
const GC_MS = 5 * 60_000;

/** At most two retries, and only for failures that may pass later (timeout, network, 5xx, 429). */
export const shouldRetry = (failureCount: number, error: unknown): boolean =>
  failureCount < MAX_RETRIES && isRetryable(error);

/** Exponential backoff: 0.5 s, 1 s, … capped at 4 s. */
export const retryDelayMs = (attempt: number): number =>
  Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_CAP_MS);

/**
 * Cache policy of the records lists: fresh for 15 s, kept 5 min, refetched
 * when the window regains focus and whenever a panel is shown again.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_MS,
        gcTime: GC_MS,
        retry: shouldRetry,
        retryDelay: retryDelayMs,
        refetchOnWindowFocus: true,
      },
    },
  });
}
