import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import { useApi } from './apiContext';
import type { ConfigKey, Page } from './contracts';
import { PAGE_SIZE } from './contracts';
import { queryKeys } from './queryKeys';
import type { SubmissionStatus } from './submissions';

/**
 * Secondary out-of-order guard (the primary one is cancellation: a superseded
 * request is aborted through its AbortSignal and never reaches the cache).
 * A page older than the cached one, by server revision, is not applied.
 */
export function newestPage<T>(queryClient: QueryClient, key: QueryKey, fresh: Page<T>): Page<T> {
  const cached = queryClient.getQueryData<Page<T>>(key);
  return cached !== undefined && cached.revision > fresh.revision ? cached : fresh;
}

/** One ranking page of a config. The previous page stays on screen while the next loads. */
export function useRankingPage(configKey: ConfigKey, page: number) {
  const { client, queryClient } = useApi();
  const key = queryKeys.ranking.page(configKey, page);
  return useQuery({
    queryKey: key,
    queryFn: async ({ signal }) =>
      newestPage(queryClient, key, await client.rankingPage(configKey, page, PAGE_SIZE, signal)),
    placeholderData: keepPreviousData,
    // Showing the tab again always refreshes it (background refetch, cached rows stay).
    refetchOnMount: 'always',
  });
}

/** Configs that have ranking records (the ranking's settings selector). */
export function useRankedConfigs() {
  const { client } = useApi();
  return useQuery({
    queryKey: queryKeys.ranking.configs(),
    queryFn: ({ signal }) => client.rankedConfigs(signal),
    refetchOnMount: 'always',
  });
}

/** One page of the player's match history, newest first. */
export function useHistoryPage(playerId: string | null, page: number) {
  const { client, queryClient } = useApi();
  const key = queryKeys.history.page(playerId ?? '', page);
  return useQuery({
    queryKey: key,
    queryFn: async ({ signal }) =>
      newestPage(
        queryClient,
        key,
        await client.historyPage(playerId ?? '', page, PAGE_SIZE, signal),
      ),
    enabled: playerId !== null,
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
}

/** Live submission state of one match (re-renders only when it changes). */
export function useSubmissionStatus(matchId: string): SubmissionStatus | null {
  const { submissions } = useApi();
  const read = useCallback(() => submissions.status(matchId), [submissions, matchId]);
  return useSyncExternalStore(submissions.subscribe, read);
}

/** Number of queued matches (dev panel). */
export function usePendingCount(): number {
  const { submissions } = useApi();
  return useSyncExternalStore(submissions.subscribe, submissions.pendingCount);
}
