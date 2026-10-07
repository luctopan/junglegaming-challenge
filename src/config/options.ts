import type { GameConfig } from './gameConfig';

/** The two parameters exposed in the Options screen. */
export interface PlayerOptions {
  readonly sessionSeconds: number;
  readonly spawnIntervalSeconds: number;
}

export interface OptionBounds {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

/** Documented limits (README "Gameplay configuration"). */
export const OPTION_BOUNDS: Readonly<Record<keyof PlayerOptions, OptionBounds>> = {
  sessionSeconds: { min: 60, max: 180, step: 10 },
  spawnIntervalSeconds: { min: 1, max: 10, step: 0.5 },
};

const OPTION_KEYS = Object.keys(OPTION_BOUNDS) as readonly (keyof PlayerOptions)[];

const GRID_TOLERANCE = 1e-9;

/** Value inside the bounds and on the step grid (60, 70, … / 1, 1.5, …). */
export function isWithinBounds(value: number, bounds: OptionBounds): boolean {
  if (!Number.isFinite(value) || value < bounds.min || value > bounds.max) return false;
  const steps = (value - bounds.min) / bounds.step;
  return Math.abs(steps - Math.round(steps)) < GRID_TOLERANCE;
}

export const describeBounds = (bounds: OptionBounds): string =>
  `Must be between ${bounds.min} and ${bounds.max} in steps of ${bounds.step}.`;

export type OptionsResult =
  | { readonly ok: true; readonly options: PlayerOptions }
  | { readonly ok: false; readonly errors: Partial<Record<keyof PlayerOptions, string>> };

/** Validates untrusted options (form input, storage). */
export function parsePlayerOptions(input: unknown): OptionsResult {
  const record: Partial<Record<string, unknown>> =
    typeof input === 'object' && input !== null ? input : {};
  const errors: Partial<Record<keyof PlayerOptions, string>> = {};
  const values: Partial<Record<keyof PlayerOptions, number>> = {};
  for (const key of OPTION_KEYS) {
    const value = record[key];
    if (typeof value === 'number' && isWithinBounds(value, OPTION_BOUNDS[key])) {
      values[key] = value;
    } else {
      errors[key] = describeBounds(OPTION_BOUNDS[key]);
    }
  }
  if (values.sessionSeconds === undefined || values.spawnIntervalSeconds === undefined) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    options: {
      sessionSeconds: values.sessionSeconds,
      spawnIntervalSeconds: values.spawnIntervalSeconds,
    },
  };
}

export const optionsFromConfig = (config: GameConfig): PlayerOptions => ({
  sessionSeconds: config.match.sessionSeconds,
  spawnIntervalSeconds: config.spawn.intervalSeconds,
});

/** Returns a new config with the player's options applied (the base is not modified). */
export const applyOptions = (base: GameConfig, options: PlayerOptions): GameConfig => ({
  ...base,
  match: { ...base.match, sessionSeconds: options.sessionSeconds },
  spawn: { ...base.spawn, intervalSeconds: options.spawnIntervalSeconds },
});
