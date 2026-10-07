/**
 * Public API of the PixiJS renderer. It reads the simulation (`WorldView`) and
 * plays domain events; it never changes game state. See ARCHITECTURE.md
 * "React ↔ PixiJS integration".
 */
export { WorldRenderer } from './WorldRenderer';
export type { RenderStats } from './WorldRenderer';
export { cachedTextureCount, loadCombatAssets } from './assets/combatAssets';
export type { LoadCombatAssetsOptions } from './assets/combatAssets';
export type { Atlas, CombatAtlases } from './assets/atlas';
export { createAudioEngine } from './audio/audioEngine';
export type { AudioEngine } from './audio/audioEngine';
export { fitViewport, preferredTextureResolution, screenToWorld, worldToScreen } from './viewport';
export type { Size, Viewport } from './viewport';
export type { WorldView } from './worldView';
export { playerHpTone } from './ships/shipVisual';
export type { HpTone } from './theme';
