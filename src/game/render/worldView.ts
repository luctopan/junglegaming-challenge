import type { World } from '../core';
import type { DeepReadonly } from '../../shared/deepFreeze';

/**
 * The simulation as the renderer sees it: deeply read-only, so views can read
 * state but never change it (enforced by the compiler and by tests that render
 * a deep-frozen world).
 */
export type WorldView = DeepReadonly<World>;
export type ShipState = WorldView['ships'][number];
export type ProjectileState = WorldView['projectiles'][number];
