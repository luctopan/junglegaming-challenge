import { useSyncExternalStore } from 'react';
import type { MatchSubmission } from '../../api/contracts';
import { DEFAULT_GAME_CONFIG } from '../../config/defaults';
import type { PlayerOptions } from '../../config/options';
import { optionsFromConfig, parsePlayerOptions } from '../../config/options';
import { browserStorage } from '../../platform/storage';
import type { CaptainProfile } from '../profile/captainName';
import { parseCaptainProfile } from '../profile/captainName';
import { parseMatchSubmission } from './lastResult';
import type { Persisted, PersistentStore } from './persistentStore';
import { createPersistentStore } from './persistentStore';

/** Versioned storage keys of the UI (the pending-submission queue gets its own in Phase 5). */
export const STORAGE_KEYS = {
  options: 'pirate.options.v1',
  profile: 'pirate.profile.v1',
  lastResult: 'pirate.lastResult.v1',
  audio: 'pirate.audio.v1',
} as const;

export const optionsStore: PersistentStore<PlayerOptions> = createPersistentStore({
  key: STORAGE_KEYS.options,
  storage: browserStorage,
  parse: (stored) => {
    const result = parsePlayerOptions(stored);
    return result.ok ? result.options : null;
  },
  fallback: () => optionsFromConfig(DEFAULT_GAME_CONFIG),
});

export const profileStore: PersistentStore<CaptainProfile | null> = createPersistentStore({
  key: STORAGE_KEYS.profile,
  storage: browserStorage,
  parse: parseCaptainProfile,
  fallback: () => null,
});

export const lastResultStore: PersistentStore<MatchSubmission | null> = createPersistentStore({
  key: STORAGE_KEYS.lastResult,
  storage: browserStorage,
  parse: parseMatchSubmission,
  fallback: () => null,
});

interface AudioSettings {
  readonly muted: boolean;
}

export const audioStore: PersistentStore<AudioSettings> = createPersistentStore({
  key: STORAGE_KEYS.audio,
  storage: browserStorage,
  parse: (stored) =>
    typeof stored === 'object' &&
    stored !== null &&
    typeof (stored as Partial<AudioSettings>).muted === 'boolean'
      ? { muted: (stored as AudioSettings).muted }
      : null,
  fallback: () => ({ muted: false }),
});

export function usePersisted<T>(store: PersistentStore<T>): Persisted<T> {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

export const usePersistedValue = <T>(store: PersistentStore<T>): T => usePersisted(store).value;
