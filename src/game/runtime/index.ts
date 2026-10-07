/**
 * Public API of the game runtime for the UI (and the dev sandbox): one
 * `GameSession` per game screen, wired to a bridge store React subscribes to.
 */
export { createGameSession, activeSessions } from './gameSession';
export type { GameSession, GameSessionOptions, SessionStats } from './gameSession';
export { IDLE_INPUT_SOURCE } from './inputSource';
export type { InputSource } from './inputSource';
export { installTestHook, resourceReport } from './testHook';
export type { PirateTestHook, ResourceReport } from './testHook';
