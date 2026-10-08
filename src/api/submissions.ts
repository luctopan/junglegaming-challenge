import type { QueryClient } from '@tanstack/react-query';
import { MutationObserver } from '@tanstack/react-query';
import type { ApiClient, SubmitOutcome } from './client';
import type { MatchSubmission } from './contracts';
import { isRetryable } from './errors';
import type { PendingQueue } from './pendingQueue';
import { queryKeys, submitMutationKey } from './queryKeys';
import { retryDelayMs, shouldRetry } from './queryClient';

/**
 * Where a match record stands. `pending`: a retryable failure (timeout,
 * network, 5xx), resent automatically on the next flush. `failed`: the server
 * rejected it (4xx); only a manual Retry sends it again.
 */
export type SubmissionStatus = 'saving' | 'saved' | 'pending' | 'failed';

export interface SubmissionService {
  /** Queues the match (persisted first) and sends it. Never throws. */
  readonly submit: (match: MatchSubmission) => void;
  /** Sends every queued match not already in flight. */
  readonly flush: () => Promise<void>;
  /** Sends one queued match again (Result screen Retry). */
  readonly retry: (matchId: string) => void;
  readonly status: (matchId: string) => SubmissionStatus | null;
  readonly pendingCount: () => number;
  /** Forgets in-memory states (dev panel Reset; the queue is cleared separately). */
  readonly reset: () => void;
  readonly subscribe: (listener: () => void) => () => void;
}

interface Dependencies {
  readonly client: ApiClient;
  readonly queryClient: QueryClient;
  readonly queue: PendingQueue;
}

export function createSubmissionService({
  client,
  queryClient,
  queue,
}: Dependencies): SubmissionService {
  const statuses = new Map<string, SubmissionStatus>();
  // Single flight per match: a Retry or a flush during a send never doubles it.
  const inFlight = new Map<string, Promise<void>>();
  const listeners = new Set<() => void>();

  const setStatus = (matchId: string, status: SubmissionStatus): void => {
    statuses.set(matchId, status);
    for (const listener of listeners) listener();
  };

  const send = (match: MatchSubmission): Promise<void> => {
    const running = inFlight.get(match.matchId);
    if (running !== undefined) return running;
    setStatus(match.matchId, 'saving');
    const observer = new MutationObserver<SubmitOutcome, unknown, MatchSubmission>(queryClient, {
      mutationKey: submitMutationKey(match.matchId),
      mutationFn: (submission) => client.submitMatch(submission),
      retry: shouldRetry,
      retryDelay: retryDelayMs,
    });
    const attempt = observer.mutate(match).then(
      async () => {
        queue.remove(match.matchId);
        setStatus(match.matchId, 'saved');
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.ranking.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.history.all }),
        ]);
      },
      (error: unknown) => {
        // Handled: the match stays queued and the Result screen shows the state.
        console.warn(`Match ${match.matchId} not saved yet`, error);
        setStatus(match.matchId, isRetryable(error) ? 'pending' : 'failed');
      },
    );
    const settled = attempt.finally(() => {
      inFlight.delete(match.matchId);
    });
    inFlight.set(match.matchId, settled);
    return settled.then(() => {
      // The server is reachable again: send whatever else is waiting.
      if (statuses.get(match.matchId) === 'saved') void flush();
    });
  };

  async function flush(): Promise<void> {
    const waiting = queue
      .list()
      .filter((match) => !inFlight.has(match.matchId) && statuses.get(match.matchId) !== 'failed');
    await Promise.all(waiting.map(send));
  }

  return {
    submit: (match) => {
      if (!queue.add(match)) console.warn('The match could not be stored on this device');
      void send(match);
    },
    flush,
    retry: (matchId) => {
      const match = queue.list().find((entry) => entry.matchId === matchId);
      if (match !== undefined) void send(match);
    },
    status: (matchId) => {
      const known = statuses.get(matchId);
      if (known !== undefined) return known;
      return queue.has(matchId) ? 'pending' : null;
    },
    pendingCount: () => queue.list().length,
    reset: () => {
      statuses.clear();
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
