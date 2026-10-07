import type { DomainEvent } from '../../core';
import { assertNever } from '../../../shared/assertNever';

/** Every sound the game plays, mapped to the delivered WAV files (docs/ASSETS.md). */
export const SOUND_CUES = {
  playerCannon: { files: ['cannon_fire_1', 'cannon_fire_2', 'cannon_fire_3'], gain: 0.7 },
  enemyCannon: { files: ['cannon_fire_1', 'cannon_fire_2', 'cannon_fire_3'], gain: 0.35 },
  broadside: { files: ['cannon_broadside'], gain: 0.8 },
  waterHit: { files: ['cannonball_water_hit_1', 'cannonball_water_hit_2'], gain: 0.35 },
  woodHit: { files: ['ship_wood_hit_1', 'ship_wood_hit_2'], gain: 0.6 },
  ram: { files: ['ship_collision'], gain: 0.8 },
  explosion: { files: ['ship_explosion_1', 'ship_explosion_2'], gain: 0.7 },
  score: { files: ['score_point'], gain: 0.5 },
  matchStart: { files: ['game_start'], gain: 0.6 },
  timeUp: { files: ['game_complete'], gain: 0.7 },
  defeat: { files: ['game_over'], gain: 0.7 },
  ambience: { files: ['ocean_ambience_loop'], gain: 0.25 },
} as const satisfies Record<string, { files: readonly string[]; gain: number }>;

export type SoundCue = keyof typeof SOUND_CUES;

/** Cues to play for a domain event; variants are chosen by the audio engine. */
export function soundCuesFor(event: DomainEvent, playerId: number): SoundCue[] {
  switch (event.type) {
    case 'shotFired':
      if (event.cannon === 'broadside') return ['broadside'];
      return [event.shipId === playerId ? 'playerCannon' : 'enemyCannon'];
    case 'projectileHit':
      return ['woodHit'];
    case 'projectileBlocked':
      return ['waterHit'];
    case 'projectileExpired':
      return event.reason === 'range' ? ['waterHit'] : [];
    case 'shipDestroyed':
      return ['explosion'];
    case 'chaserRammed':
      return ['ram'];
    case 'scoreChanged':
      return ['score'];
    case 'matchEnded':
      return [event.reason === 'time_up' ? 'timeUp' : 'defeat'];
    case 'shipDamaged':
    case 'enemySpawned':
      return [];
    default:
      return assertNever(event, 'domain event');
  }
}

/** Unique WAV files used by the cues (decoded once, in the background). */
export const SOUND_FILES: readonly string[] = [
  ...new Set(Object.values(SOUND_CUES).flatMap((cue) => cue.files)),
].sort();
