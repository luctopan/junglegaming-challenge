import { useCallback, useEffect, useState } from 'react';

/**
 * Query state for the records panels, shaped like the subset of TanStack
 * Query's result they use (`status`, `data`, `isFetching`, `refetch`), so the
 * API layer (Phase 5) can replace this hook without touching the panels.
 * While a new key loads, the previous data stays on screen (placeholder).
 */
export type RecordsQuery<T> =
  | { readonly status: 'pending'; readonly refetch: () => void }
  | { readonly status: 'error'; readonly refetch: () => void; readonly isFetching: boolean }
  | {
      readonly status: 'success';
      readonly data: T;
      readonly isFetching: boolean;
      readonly refetch: () => void;
    };

interface Settled<T> {
  readonly key: string;
  readonly attempt: number;
  readonly outcome: { readonly ok: true; readonly data: T } | { readonly ok: false };
}

/**
 * Loads `fetcher` for `key`; a superseded or unmounted request is aborted and
 * its late answer ignored, so an older response never replaces newer data.
 */
export function useRecordsQuery<T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
): RecordsQuery<T> {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const [lastData, setLastData] = useState<{ readonly data: T } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetcher(controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return;
        setSettled({ key, attempt, outcome: { ok: true, data } });
        setLastData({ data });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        // Handled: shown as the panel's error state with a Retry button.
        console.warn('Could not load records', error);
        setSettled({ key, attempt, outcome: { ok: false } });
      },
    );
    return () => {
      controller.abort();
    };
  }, [key, attempt, fetcher]);

  const refetch = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  const current = settled !== null && settled.key === key && settled.attempt === attempt;
  if (current && !settled.outcome.ok) return { status: 'error', refetch, isFetching: false };
  if (current && settled.outcome.ok) {
    return { status: 'success', data: settled.outcome.data, isFetching: false, refetch };
  }
  // Loading this key: keep showing the previous page if there is one.
  if (lastData !== null)
    return { status: 'success', data: lastData.data, isFetching: true, refetch };
  return { status: 'pending', refetch };
}
