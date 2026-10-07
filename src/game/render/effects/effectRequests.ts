import type { DomainEvent, WeaponSlot } from '../../core';
import { assertNever } from '../../../shared/assertNever';

/**
 * What the renderer should show for a domain event. Pure mapping, so the
 * feedback rules are unit-tested without Pixi; the effect layer only plays them.
 */
export type EffectRequest =
  | { readonly kind: 'muzzle'; readonly x: number; readonly y: number; readonly rotation: number }
  | { readonly kind: 'hit'; readonly x: number; readonly y: number }
  | { readonly kind: 'puff'; readonly x: number; readonly y: number }
  | { readonly kind: 'splash'; readonly x: number; readonly y: number }
  | { readonly kind: 'explosion'; readonly x: number; readonly y: number }
  | {
      readonly kind: 'debris';
      readonly x: number;
      readonly y: number;
      readonly amount: 'hit' | 'destroy';
    }
  | { readonly kind: 'flash'; readonly shipId: number }
  | { readonly kind: 'shake' };

export interface EffectContext {
  readonly playerId: number;
  /** Current heading of a ship, if it still exists. */
  headingOf(shipId: number): number | undefined;
}

const QUARTER_TURN = Math.PI / 2;

/** Broadsides fire perpendicular to the hull: port (left) = heading − 90°. */
const SLOT_ANGLE: Readonly<Record<WeaponSlot, number>> = {
  front: 0,
  left: -QUARTER_TURN,
  right: QUARTER_TURN,
};

export function effectRequestsFor(event: DomainEvent, context: EffectContext): EffectRequest[] {
  switch (event.type) {
    case 'shotFired': {
      const heading = context.headingOf(event.shipId) ?? 0;
      const rotation = heading + SLOT_ANGLE[event.slot];
      return event.muzzles.map((m) => ({ kind: 'muzzle', x: m.x, y: m.y, rotation }));
    }
    case 'projectileHit':
      return [
        { kind: 'hit', x: event.pos.x, y: event.pos.y },
        { kind: 'debris', x: event.pos.x, y: event.pos.y, amount: 'hit' },
      ];
    case 'projectileBlocked':
      return [{ kind: 'puff', x: event.pos.x, y: event.pos.y }];
    case 'projectileExpired':
      // A ball at the end of its range drops into the water; one leaving the arena is just gone.
      return event.reason === 'range' ? [{ kind: 'splash', x: event.pos.x, y: event.pos.y }] : [];
    case 'shipDamaged':
      return event.shipId === context.playerId
        ? [{ kind: 'flash', shipId: event.shipId }, { kind: 'shake' }]
        : [{ kind: 'flash', shipId: event.shipId }];
    case 'shipDestroyed':
      return [
        { kind: 'explosion', x: event.pos.x, y: event.pos.y },
        { kind: 'debris', x: event.pos.x, y: event.pos.y, amount: 'destroy' },
      ];
    case 'enemySpawned':
      return [{ kind: 'splash', x: event.pos.x, y: event.pos.y }];
    case 'chaserRammed':
    case 'scoreChanged':
    case 'matchEnded':
      // Rams are shown by the destruction + damage events of the same step.
      return [];
    default:
      return assertNever(event, 'domain event');
  }
}
