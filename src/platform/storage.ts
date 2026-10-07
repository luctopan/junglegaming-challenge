/**
 * Typed JSON access to `localStorage`. Every call is wrapped: storage may be
 * missing, full or blocked (private mode, disabled cookies), and stored values
 * may be corrupted or written by an older version. Nothing here throws; a
 * read reports what it found and the caller decides on the fallback.
 */

/** The subset of the Web Storage API used here (an in-memory one in unit tests). */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type StoredValue =
  | { readonly kind: 'missing' }
  | { readonly kind: 'ok'; readonly value: unknown }
  /** Present but not valid JSON, or the storage could not be read. */
  | { readonly kind: 'corrupt'; readonly reason: string };

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** `localStorage`, or null where accessing it throws (e.g. blocked site data). */
export function browserStorage(): KeyValueStorage | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function readStored(storage: KeyValueStorage | null, key: string): StoredValue {
  if (storage === null) return { kind: 'missing' };
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch (error) {
    return { kind: 'corrupt', reason: describe(error) };
  }
  if (raw === null) return { kind: 'missing' };
  try {
    return { kind: 'ok', value: JSON.parse(raw) as unknown };
  } catch (error) {
    return { kind: 'corrupt', reason: describe(error) };
  }
}

/** Returns false when the value could not be stored (quota, blocked storage). */
export function writeStored(storage: KeyValueStorage | null, key: string, value: unknown): boolean {
  if (storage === null) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Could not save "${key}"`, error);
    return false;
  }
}

export function removeStored(storage: KeyValueStorage | null, key: string): void {
  if (storage === null) return;
  try {
    storage.removeItem(key);
  } catch (error) {
    console.warn(`Could not remove "${key}"`, error);
  }
}

/** In-memory storage for unit tests and as a stand-in when the browser blocks storage. */
export function memoryStorage(initial: Readonly<Record<string, string>> = {}): KeyValueStorage {
  const entries = new Map(Object.entries(initial));
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
    removeItem: (key) => {
      entries.delete(key);
    },
  };
}
