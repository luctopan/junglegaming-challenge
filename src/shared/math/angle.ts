import { TAU } from './constants';

const DEGREES_PER_HALF_TURN = 180;

export const toRadians = (degrees: number): number => (degrees * Math.PI) / DEGREES_PER_HALF_TURN;

/** Normalises an angle to the half-open interval (-π, π]. */
export function wrapAngle(angle: number): number {
  const wrapped = angle - TAU * Math.floor((angle + Math.PI) / TAU);
  return wrapped === -Math.PI ? Math.PI : wrapped;
}

/** Shortest signed rotation from `from` to `to`, in (-π, π]. */
export const angleDelta = (from: number, to: number): number => wrapAngle(to - from);

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
