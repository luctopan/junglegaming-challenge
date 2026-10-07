import type { PlayState } from './matchDriver';

/**
 * Whether the Pixi ticker should render continuously. A paused match shows one
 * final frame and then costs no CPU or GPU until Resume. Under the test
 * manual clock (`onDemand`) nothing moves between `advance` calls, so frames
 * are rendered only when asked for: one per `advance`, not 60 per second of
 * wall time (which starved the e2e suite on CPU-only WebGL).
 * An ended match keeps rendering so the last explosions play out.
 */
export const tickerShouldRun = (onDemand: boolean, state: PlayState): boolean =>
  !onDemand && state !== 'paused';
