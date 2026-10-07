import { applyConfigOverrides } from '../../config/configOverrides';
import { DEFAULT_GAME_CONFIG } from '../../config/defaults';
import type { GameConfig } from '../../config/gameConfig';
import type { PlayerOptions } from '../../config/options';
import { applyOptions } from '../../config/options';

let warned = false;

/**
 * Config snapshot for the next match: the defaults with the player's options
 * (validated when they were saved). On the dev server only, `?cfg.<path>=<value>`
 * URL parameters then override balancing for manual play (README "Balance
 * overrides"); `import.meta.env.DEV` is a build-time constant, so the
 * production bundle drops the override module entirely (scripts/verify-dist.mjs).
 * The simulation freezes the returned config when the match is created.
 */
export function matchConfig(options: PlayerOptions): GameConfig {
  const config = applyOptions(DEFAULT_GAME_CONFIG, options);
  if (!import.meta.env.DEV) return config;
  const result = applyConfigOverrides(config, new URLSearchParams(window.location.search));
  // The console notes once per page load, not once per match.
  if (!warned) {
    warned = true;
    for (const warning of result.warnings) console.warn(`[dev config] ${warning}`);
    if (result.applied.length > 0) {
      console.warn(`[dev config] Balance overrides active: ${result.applied.join(', ')}`);
    }
  }
  return result.config;
}
