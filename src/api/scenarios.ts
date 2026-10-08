/**
 * Network scenarios of the mock backend (docs/PLAN.md §3.4). Part of the API
 * contract because both sides use it: MSW implements them, the dev panel
 * selects them through `/api/__mock/*`.
 */
export const SCENARIOS = [
  'success',
  'empty',
  'multi-page',
  'slow',
  'variable-latency',
  'out-of-order',
  'timeout',
  'network-error',
  'http-400',
  'http-500',
  'ranking-fail',
  'history-fail',
  'write-timeout-after-commit',
  'unavailable-then-recover',
] as const;

export type ScenarioName = (typeof SCENARIOS)[number];

export const DEFAULT_SCENARIO: ScenarioName = 'success';

export const isScenarioName = (value: unknown): value is ScenarioName =>
  SCENARIOS.some((name) => name === value);

export const SCENARIO_DESCRIPTIONS: Readonly<Record<ScenarioName, string>> = {
  success: 'Normal latency, fixture captains',
  empty: 'No fixture records',
  'multi-page': 'Many fixture records (long pagination)',
  slow: 'Every request takes about 2.5 s',
  'variable-latency': 'Random latency between 50 ms and 2 s (seeded)',
  'out-of-order': 'Every other read is slow, so answers arrive out of order',
  timeout: 'Requests never answer (client timeout)',
  'network-error': 'Every request fails at the network level',
  'http-400': 'Every request is rejected with 400',
  'http-500': 'Every request fails with 500',
  'ranking-fail': 'Ranking reads fail with 500',
  'history-fail': 'History reads fail with 500',
  'write-timeout-after-commit': 'The first save of each match is stored, then times out',
  'unavailable-then-recover': 'Saves fail with 503 for the first 3 attempts, or until Recover',
};

/** State of the mock backend, as the dev panel shows it. */
export interface MockStatus {
  readonly scenario: ScenarioName;
  /** `unavailable-then-recover` has recovered. */
  readonly recovered: boolean;
  readonly records: number;
}

export function isMockStatus(value: unknown): value is MockStatus {
  if (typeof value !== 'object' || value === null) return false;
  const status = value as Partial<Record<keyof MockStatus, unknown>>;
  return (
    isScenarioName(status.scenario) &&
    typeof status.recovered === 'boolean' &&
    typeof status.records === 'number'
  );
}
