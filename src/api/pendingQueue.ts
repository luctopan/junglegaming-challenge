import type { KeyValueStorage } from '../platform/storage';
import { readStored, removeStored, writeStored } from '../platform/storage';
import type { MatchSubmission } from './contracts';
import { parseMatchSubmission } from './matchSubmission';

export const PENDING_QUEUE_KEY = 'pirate.pending.v1';

/**
 * Matches not yet confirmed by the server, persisted before any request is
 * made, so a failure, a closed tab or a refresh never loses a record. Entries
 * are stored exactly as built at match end: a resend is byte-identical and the
 * server answers it as the same match (idempotent PUT by `matchId`).
 */
export interface PendingQueue {
  list(): readonly MatchSubmission[];
  /** Adds the match unless it is already queued; false if it could not be persisted. */
  add(match: MatchSubmission): boolean;
  remove(matchId: string): void;
  has(matchId: string): boolean;
  clear(): void;
}

export function createPendingQueue(storage: () => KeyValueStorage | null): PendingQueue {
  // Mirrors storage; also the fallback when storage is blocked or full.
  let entries = load(storage());

  const save = (next: readonly MatchSubmission[]): boolean => {
    entries = next;
    return writeStored(storage(), PENDING_QUEUE_KEY, next);
  };

  return {
    list: () => {
      // Another browser tab may have changed the queue since the last read.
      const stored = readStored(storage(), PENDING_QUEUE_KEY);
      if (stored.kind !== 'corrupt') entries = parseQueue(stored.kind === 'ok' ? stored.value : []);
      return entries;
    },
    add: (match) => {
      if (entries.some((entry) => entry.matchId === match.matchId)) return true;
      return save([...entries, match]);
    },
    remove: (matchId) => {
      save(entries.filter((entry) => entry.matchId !== matchId));
    },
    has: (matchId) => entries.some((entry) => entry.matchId === matchId),
    clear: () => {
      entries = [];
      removeStored(storage(), PENDING_QUEUE_KEY);
    },
  };
}

function load(storage: KeyValueStorage | null): readonly MatchSubmission[] {
  const stored = readStored(storage, PENDING_QUEUE_KEY);
  if (stored.kind === 'corrupt') console.warn('Ignoring a corrupted pending queue:', stored.reason);
  return stored.kind === 'ok' ? parseQueue(stored.value) : [];
}

/** Keeps every valid entry: one damaged record must not drop the others. */
function parseQueue(value: unknown): readonly MatchSubmission[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item) => {
    const match = parseMatchSubmission(item);
    if (match === null || seen.has(match.matchId)) return [];
    seen.add(match.matchId);
    return [match];
  });
}
