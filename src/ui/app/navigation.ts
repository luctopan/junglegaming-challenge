import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';

export const ROUTES = {
  menu: '/',
  options: '/options',
  play: '/play',
  result: '/result',
  ranking: '/records/ranking',
  history: '/records/history',
} as const;

export type RecordsTab = 'ranking' | 'history';

export const recordsPath = (tab: RecordsTab): string =>
  tab === 'ranking' ? ROUTES.ranking : ROUTES.history;

/**
 * Navigation that keeps the page's query string, so URL switches given on
 * open (`?test=1`, `?seed=`, `?dev=1`, dev balance overrides) hold on every
 * screen of the session.
 */
export function useAppNavigate(): (path: string, options?: { replace?: boolean }) => void {
  const navigate = useNavigate();
  const { search } = useLocation();
  return useCallback(
    (path, options) => {
      void navigate({ pathname: path, search }, options);
    },
    [navigate, search],
  );
}

/**
 * A match starts only from an in-app action (Play, Play again). The flag
 * lives in memory, so a reload or a history entry pointing at `/play` finds
 * it unset and returns to the menu: an interrupted match is abandoned, never
 * resumed or recorded (docs/DECISIONS.md I8).
 */
let matchRequested = false;

export const requestMatch = (): void => {
  matchRequested = true;
};

export const isMatchRequested = (): boolean => matchRequested;

export const clearMatchRequest = (): void => {
  matchRequested = false;
};
