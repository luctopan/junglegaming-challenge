import type { Clock } from '../shared/clock';

/** Wall clock for the real game loop (monotonic, unaffected by system time changes). */
export const realClock: Clock = { now: () => performance.now() };
