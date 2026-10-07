import { angleDelta } from '../../shared/math/angle';
import type { Vec2 } from '../../shared/math/vec2';

/** Mutable pose written in place every frame (no per-frame allocation). */
export interface Pose {
  x: number;
  y: number;
  heading: number;
}

export const createPose = (): Pose => ({ x: 0, y: 0, heading: 0 });

/**
 * Pose between the previous and the current simulation step. `alpha` is the
 * stepper's leftover fraction of a step, so motion stays smooth on displays
 * faster than the 60 Hz simulation without the view ever running ahead of it.
 */
export function interpolatePose(
  out: Pose,
  prevPos: Vec2,
  pos: Vec2,
  prevHeading: number,
  heading: number,
  alpha: number,
): Pose {
  out.x = prevPos.x + (pos.x - prevPos.x) * alpha;
  out.y = prevPos.y + (pos.y - prevPos.y) * alpha;
  // Shortest way round, so a heading crossing ±π never spins the sprite.
  out.heading = prevHeading + angleDelta(prevHeading, heading) * alpha;
  return out;
}
