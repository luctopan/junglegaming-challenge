import { useMemo } from 'react';
import { useLocation } from 'react-router';
import { isTestMode } from '../../platform/testMode';
import { lastResultStore, usePersistedValue } from '../state/settings';
import type { RecordsContext } from './temporaryRecords';
import { recordsModeFrom } from './temporaryRecords';

/**
 * TEMPORARY (Phase 4): what the in-memory records source needs. `?records=`
 * forces a state only on the dev server and in test mode, never in a normal
 * production visit. `key` changes whenever the data would.
 */
export function useRecordsContext(): RecordsContext & { readonly key: string } {
  const { search } = useLocation();
  const lastResult = usePersistedValue(lastResultStore);
  const mode = recordsModeFrom(search, import.meta.env.DEV || isTestMode(search));
  return useMemo(
    () => ({ mode, lastResult, key: `${mode}:${lastResult?.matchId ?? 'none'}` }),
    [mode, lastResult],
  );
}
