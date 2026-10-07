import { cloneDeepFrozen } from '../shared/deepFreeze';
import type { GameConfig } from './gameConfig';
import { validateGameConfig } from './validate';

/**
 * Development-only balance overrides from the URL, e.g.
 * `?cfg.ships.player.maxHp=150&cfg.weapons.shooterCannon.projectileSpeed=300`.
 * Only the dev server applies them (see `ui/game/matchConfig.ts`); the
 * production bundle does not even contain this module (scripts/verify-dist.mjs).
 *
 * Each override must name an existing number or boolean field of `GameConfig`
 * and keep the whole config valid; anything else is reported and ignored, so
 * a typo can never silently change the game.
 */
export const OVERRIDE_PREFIX = 'cfg.';

export interface OverrideOutcome {
  readonly config: GameConfig;
  /** Overrides applied, as `path=value`. */
  readonly applied: readonly string[];
  /** One readable line per ignored override. */
  readonly warnings: readonly string[];
}

type Leaf = number | boolean;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function parseLeaf(raw: string, current: Leaf): Leaf | null {
  const text = raw.trim();
  if (typeof current === 'boolean') {
    if (text === 'true') return true;
    if (text === 'false') return false;
    return null;
  }
  const value = Number(text);
  return text !== '' && Number.isFinite(value) ? value : null;
}

/** Copy of `node` with the leaf at `path` set from `raw`, or why that is not possible. */
function withLeaf(
  node: unknown,
  path: readonly string[],
  raw: string,
): { node: unknown; value: Leaf } | { error: string } {
  const [key, ...rest] = path;
  if (key === undefined || !isRecord(node) || !Object.hasOwn(node, key)) {
    return { error: 'unknown setting' };
  }
  const child = node[key];
  const copy: unknown = Array.isArray(node) ? [...node] : { ...node };
  if (!isRecord(copy)) return { error: 'unknown setting' };
  if (rest.length > 0) {
    const nested = withLeaf(child, rest, raw);
    if ('error' in nested) return nested;
    copy[key] = nested.node;
    return { node: copy, value: nested.value };
  }
  if (typeof child !== 'number' && typeof child !== 'boolean') {
    return { error: 'not a number or boolean setting' };
  }
  const value = parseLeaf(raw, child);
  if (value === null) {
    return { error: typeof child === 'boolean' ? 'expected true or false' : 'not a finite number' };
  }
  copy[key] = value;
  return { node: copy, value };
}

/**
 * Applies the `cfg.*` entries of `params` to `base`, in order. Every other
 * parameter is ignored. The result is deep-frozen like the defaults.
 */
export function applyConfigOverrides(
  base: GameConfig,
  params: Iterable<readonly [string, string]>,
): OverrideOutcome {
  let config: unknown = base;
  const applied: string[] = [];
  const warnings: string[] = [];

  for (const [name, raw] of params) {
    if (!name.startsWith(OVERRIDE_PREFIX)) continue;
    const path = name.slice(OVERRIDE_PREFIX.length);
    const result = withLeaf(config, path.split('.'), raw);
    if ('error' in result) {
      warnings.push(`Ignoring ${name}=${raw}: ${result.error}.`);
      continue;
    }
    // The shape was copied from a valid GameConfig and only a leaf of the same type changed.
    const candidate = result.node as GameConfig;
    const validation = validateGameConfig(candidate);
    if (!validation.ok) {
      const reasons = validation.issues.map((issue) => `${issue.path} ${issue.message}`);
      warnings.push(`Ignoring ${name}=${raw}: ${reasons.join('; ')}.`);
      continue;
    }
    config = candidate;
    applied.push(`${path}=${String(result.value)}`);
  }

  return {
    config: applied.length === 0 ? base : cloneDeepFrozen<GameConfig>(config as GameConfig),
    applied,
    warnings,
  };
}
