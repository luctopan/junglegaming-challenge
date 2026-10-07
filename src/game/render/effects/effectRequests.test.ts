import { describe, expect, it } from 'vitest';
import type { DomainEvent } from '../../core';
import { soundCuesFor, SOUND_CUES, SOUND_FILES } from '../audio/soundCues';
import { effectRequestsFor } from './effectRequests';

const context = { playerId: 0, headingOf: (id: number) => (id === 0 ? 0 : Math.PI) };
const pos = { x: 10, y: 20 };

describe('effectRequestsFor', () => {
  it('flashes broadside muzzles perpendicular to the hull, one per ball', () => {
    const event: DomainEvent = {
      type: 'shotFired',
      time: 1,
      shipId: 0,
      slot: 'right',
      cannon: 'broadside',
      muzzles: [pos, pos, pos],
    };
    const requests = effectRequestsFor(event, context);
    expect(requests).toHaveLength(3);
    expect(requests[0]).toMatchObject({ kind: 'muzzle', rotation: Math.PI / 2 });
  });

  it('shakes the camera only when the player is damaged', () => {
    const hitPlayer: DomainEvent = { type: 'shipDamaged', time: 1, shipId: 0, amount: 7, hp: 1 };
    const hitEnemy: DomainEvent = { ...hitPlayer, shipId: 4 };
    expect(effectRequestsFor(hitPlayer, context).map((r) => r.kind)).toEqual(['flash', 'shake']);
    expect(effectRequestsFor(hitEnemy, context).map((r) => r.kind)).toEqual(['flash']);
  });

  it('explodes destroyed ships and splashes balls that fall short', () => {
    const destroyed: DomainEvent = {
      type: 'shipDestroyed',
      time: 1,
      shipId: 3,
      kind: 'chaser',
      cause: 'ram',
      killerTeam: 'enemy',
      pos,
    };
    expect(effectRequestsFor(destroyed, context).map((r) => r.kind)).toEqual([
      'explosion',
      'debris',
    ]);
    const fell: DomainEvent = {
      type: 'projectileExpired',
      time: 1,
      projectileId: 1,
      pos,
      reason: 'range',
    };
    expect(effectRequestsFor(fell, context)).toEqual([{ kind: 'splash', ...pos }]);
    expect(effectRequestsFor({ ...fell, reason: 'outOfArena' }, context)).toEqual([]);
  });
});

describe('soundCuesFor', () => {
  it('tells player shots from enemy shots and broadsides', () => {
    const shot = (
      shipId: number,
      cannon: 'front' | 'broadside' | 'shooterCannon',
    ): DomainEvent => ({
      type: 'shotFired',
      time: 0,
      shipId,
      slot: 'front',
      cannon,
      muzzles: [pos],
    });
    expect(soundCuesFor(shot(0, 'front'), 0)).toEqual(['playerCannon']);
    expect(soundCuesFor(shot(5, 'shooterCannon'), 0)).toEqual(['enemyCannon']);
    expect(soundCuesFor(shot(0, 'broadside'), 0)).toEqual(['broadside']);
  });

  it('plays the end sound matching the end reason', () => {
    expect(soundCuesFor({ type: 'matchEnded', time: 9, reason: 'time_up', score: 1 }, 0)).toEqual([
      'timeUp',
    ]);
    expect(soundCuesFor({ type: 'matchEnded', time: 9, reason: 'defeated', score: 1 }, 0)).toEqual([
      'defeat',
    ]);
  });

  it('only references delivered WAV files', () => {
    const delivered = [
      'cannon_broadside',
      'cannon_fire_1',
      'cannon_fire_2',
      'cannon_fire_3',
      'cannonball_water_hit_1',
      'cannonball_water_hit_2',
      'game_complete',
      'game_over',
      'game_start',
      'ocean_ambience_loop',
      'score_point',
      'ship_collision',
      'ship_explosion_1',
      'ship_explosion_2',
      'ship_wood_hit_1',
      'ship_wood_hit_2',
    ];
    expect(SOUND_FILES).toEqual(delivered);
    expect(Object.keys(SOUND_CUES)).toContain('ambience');
  });
});
