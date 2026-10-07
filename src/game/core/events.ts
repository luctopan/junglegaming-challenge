import type { Vec2 } from '../../shared/math/vec2';
import type { CannonKind, EndReason, EnemyKind, ShipKind, Team, WeaponSlot } from './types';

/**
 * Facts produced by a simulation step, consumed by render (effects), audio and
 * UI. `time` is the active match time in seconds at the end of the step.
 */
export type DomainEvent =
  | {
      readonly type: 'shotFired';
      readonly time: number;
      readonly shipId: number;
      readonly slot: WeaponSlot;
      readonly cannon: CannonKind;
      readonly muzzles: readonly Vec2[];
    }
  | {
      readonly type: 'projectileHit';
      readonly time: number;
      readonly projectileId: number;
      readonly targetId: number;
      readonly pos: Vec2;
    }
  | {
      readonly type: 'projectileBlocked';
      readonly time: number;
      readonly projectileId: number;
      readonly pos: Vec2;
    }
  | {
      readonly type: 'projectileExpired';
      readonly time: number;
      readonly projectileId: number;
      readonly pos: Vec2;
      readonly reason: 'range' | 'outOfArena';
    }
  | {
      readonly type: 'shipDamaged';
      readonly time: number;
      readonly shipId: number;
      readonly amount: number;
      readonly hp: number;
    }
  | {
      readonly type: 'shipDestroyed';
      readonly time: number;
      readonly shipId: number;
      readonly kind: ShipKind;
      readonly cause: 'projectile' | 'ram';
      readonly killerTeam: Team;
      readonly pos: Vec2;
    }
  | {
      readonly type: 'chaserRammed';
      readonly time: number;
      readonly chaserId: number;
      readonly targetId: number;
      readonly pos: Vec2;
    }
  | {
      readonly type: 'enemySpawned';
      readonly time: number;
      readonly shipId: number;
      readonly kind: EnemyKind;
      readonly pos: Vec2;
    }
  | { readonly type: 'scoreChanged'; readonly time: number; readonly score: number }
  | {
      readonly type: 'matchEnded';
      readonly time: number;
      readonly reason: EndReason;
      readonly score: number;
    };

export type DomainEventType = DomainEvent['type'];
