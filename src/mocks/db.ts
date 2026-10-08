import type { MatchRecord, MatchSubmission } from '../api/contracts';
import { configKeyOf } from '../api/contracts';
import { parseMatchSubmission } from '../api/matchSubmission';
import type { KeyValueStorage } from '../platform/storage';
import { readStored, removeStored, writeStored } from '../platform/storage';
import { isSameMatch, toRecord } from './ranking';

export const MOCK_DB_KEY = 'pirate.mockdb.v1';
/** Kept apart from the db so a Reset never moves it backwards (client revision guard). */
export const MOCK_REVISION_KEY = 'pirate.mockdb.revision.v1';

export type PutResult =
  | { readonly kind: 'created'; readonly record: MatchRecord }
  | { readonly kind: 'existing'; readonly record: MatchRecord }
  | { readonly kind: 'conflict' };

/**
 * The mock backend's storage: matches registered by this browser, in
 * localStorage, so confirmed records survive a refresh and are shared by
 * every tab. Fixtures are not stored; the scenario adds them at read time.
 */
export interface MockDb {
  records(): readonly MatchRecord[];
  /** Idempotent by `matchId`: the identical payload again is `existing`, a different one `conflict`. */
  put(match: MatchSubmission, now: Date): PutResult;
  revision(): number;
  reset(): void;
}

export function createMockDb(storage: () => KeyValueStorage | null): MockDb {
  const read = (): MatchRecord[] => {
    const stored = readStored(storage(), MOCK_DB_KEY);
    if (stored.kind !== 'ok' || !Array.isArray(stored.value)) return [];
    return stored.value.flatMap((item: unknown) => {
      const match = parseMatchSubmission(item);
      const recordedAt = (item as Partial<MatchRecord>).recordedAt;
      return match === null || typeof recordedAt !== 'string' ? [] : [toRecord(match, recordedAt)];
    });
  };
  const revision = (): number => {
    const stored = readStored(storage(), MOCK_REVISION_KEY);
    return stored.kind === 'ok' && typeof stored.value === 'number' ? stored.value : 1;
  };
  const bump = (): void => {
    writeStored(storage(), MOCK_REVISION_KEY, revision() + 1);
  };

  return {
    records: read,
    revision,
    put: (match, now) => {
      const records = read();
      const existing = records.find((record) => record.matchId === match.matchId);
      if (existing !== undefined) {
        return isSameMatch(existing, match)
          ? { kind: 'existing', record: existing }
          : { kind: 'conflict' };
      }
      const record: MatchRecord = {
        ...match,
        configKey: configKeyOf(match.config),
        recordedAt: now.toISOString(),
      };
      writeStored(storage(), MOCK_DB_KEY, [...records, record]);
      bump();
      return { kind: 'created', record };
    },
    reset: () => {
      removeStored(storage(), MOCK_DB_KEY);
      bump();
    },
  };
}
