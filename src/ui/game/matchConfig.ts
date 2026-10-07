import { applyConfigOverrides } from '../../config/configOverrides';
import { DEFAULT_GAME_CONFIG } from '../../config/defaults';
import type { GameConfig } from '../../config/gameConfig';

let resolved: GameConfig | null = null;

/**
 * Config for the next match. On the dev server only, `?cfg.<path>=<value>`
 * URL parameters override balancing for manual play (README "Balance
 * overrides"). `import.meta.env.DEV` is a build-time constant, so the
 * production bundle keeps only the first return and drops the override
 * module entirely (checked by scripts/verify-dist.mjs).
 * Resolved once per page load, so the console notes appear once.
 */
export function matchConfig(): GameConfig {
  if (!import.meta.env.DEV) return DEFAULT_GAME_CONFIG;
  if (resolved !== null) return resolved;
  const { config, applied, warnings } = applyConfigOverrides(
    DEFAULT_GAME_CONFIG,
    new URLSearchParams(window.location.search),
  );
  for (const warning of warnings) console.warn(`[dev config] ${warning}`);
  if (applied.length > 0)
    console.warn(`[dev config] Balance overrides active: ${applied.join(', ')}`);
  resolved = config;
  return config;
}
