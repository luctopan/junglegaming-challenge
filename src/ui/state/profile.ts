import { newUuid } from '../../platform/uuid';
import type { CaptainProfile } from '../profile/captainName';
import { profileStore } from './settings';

/** First captain of this browser: a new stable `playerId` with the chosen name. */
export function createCaptain(name: string): CaptainProfile {
  const profile = { playerId: newUuid(), name };
  profileStore.set(profile);
  return profile;
}

/** Renames the captain; the `playerId` (history and ranking ownership) never changes. */
export function renameCaptain(profile: CaptainProfile, name: string): CaptainProfile {
  const renamed = { ...profile, name };
  profileStore.set(renamed);
  return renamed;
}
