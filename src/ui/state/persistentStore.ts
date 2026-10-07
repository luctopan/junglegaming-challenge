import type { KeyValueStorage } from '../../platform/storage';
import { readStored, writeStored } from '../../platform/storage';

/** What the store holds: the value, and whether it replaced an unreadable stored one. */
export interface Persisted<T> {
  readonly value: T;
  /**
   * The stored value was corrupted or invalid and the fallback is shown
   * instead. Cleared by the next successful save, so the UI can tell the
   * player once (accessible message) without nagging afterwards.
   */
  readonly recovered: boolean;
}

export interface PersistentStore<T> {
  /** Stable between changes, as `useSyncExternalStore` requires. */
  readonly getSnapshot: () => Persisted<T>;
  readonly subscribe: (listener: () => void) => () => void;
  /** Updates the value and persists it; returns false if it could not be stored. */
  set(value: T): boolean;
}

export interface PersistentStoreOptions<T> {
  readonly key: string;
  /** Resolved lazily, so a module-level store never touches storage at import time. */
  readonly storage: () => KeyValueStorage | null;
  /** Validates untrusted stored data; null = invalid. */
  readonly parse: (stored: unknown) => T | null;
  readonly fallback: () => T;
}

/**
 * External store backed by one versioned storage key. The stored value is
 * read and validated once, on first access; corrupt or invalid data falls
 * back to the default (never thrown at the UI) and is flagged `recovered`.
 */
export function createPersistentStore<T>(options: PersistentStoreOptions<T>): PersistentStore<T> {
  const { key, storage, parse, fallback } = options;
  let snapshot: Persisted<T> | null = null;
  const listeners = new Set<() => void>();

  const load = (): Persisted<T> => {
    const stored = readStored(storage(), key);
    switch (stored.kind) {
      case 'missing':
        return { value: fallback(), recovered: false };
      case 'corrupt':
        console.warn(`Ignored unreadable saved data "${key}": ${stored.reason}`);
        return { value: fallback(), recovered: true };
      case 'ok': {
        const value = parse(stored.value);
        if (value !== null) return { value, recovered: false };
        console.warn(`Ignored invalid saved data "${key}"`);
        return { value: fallback(), recovered: true };
      }
    }
  };

  const getSnapshot = (): Persisted<T> => {
    snapshot ??= load();
    return snapshot;
  };

  return {
    getSnapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set(value) {
      const saved = writeStored(storage(), key, value);
      // The new value applies for this page either way; `recovered` stays until it is saved.
      snapshot = { value, recovered: saved ? false : getSnapshot().recovered };
      for (const listener of listeners) listener();
      return saved;
    },
  };
}
