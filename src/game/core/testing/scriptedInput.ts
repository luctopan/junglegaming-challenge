import type { PlayerInput } from '../types';
import { IDLE_INPUT } from '../types';

/** Input changes every 1/6 s: a boundary that is a frame time at 30, 60 and 144 Hz alike. */
export const SEGMENTS_PER_SECOND = 6;

const PATTERNS: readonly PlayerInput[] = [
  { forward: true, turn: 0, fireFront: false, fireLeft: false, fireRight: false },
  { forward: true, turn: -1, fireFront: true, fireLeft: false, fireRight: false },
  { forward: true, turn: 1, fireFront: false, fireLeft: true, fireRight: false },
  { forward: false, turn: 1, fireFront: false, fireLeft: false, fireRight: true },
  { forward: true, turn: 0, fireFront: true, fireLeft: true, fireRight: true },
  { forward: false, turn: 0, fireFront: false, fireLeft: false, fireRight: false },
  { forward: true, turn: -1, fireFront: false, fireLeft: false, fireRight: true },
];
const SEGMENT_STRIDE = 3;

/**
 * Scripted input held during the frame interval that *ends* at `frameEndSeconds`.
 * Segment k covers (k/6, (k+1)/6], so the frame ending exactly on a boundary still
 * sees the input that was held during it, at every frame rate.
 */
export function scriptedInputAt(frameEndSeconds: number): PlayerInput {
  const segment = Math.max(0, Math.ceil(frameEndSeconds * SEGMENTS_PER_SECOND - 1e-9) - 1);
  const index =
    (segment * SEGMENT_STRIDE + Math.floor(segment / PATTERNS.length)) % PATTERNS.length;
  return PATTERNS[index] ?? IDLE_INPUT;
}
