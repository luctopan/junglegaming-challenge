import type { ScenarioName } from '../api/scenarios';
import { DEFAULT_SCENARIO, isScenarioName } from '../api/scenarios';
import type { KeyValueStorage } from '../platform/storage';
import { readStored, writeStored } from '../platform/storage';
import { assertNever } from '../shared/assertNever';
import type { Rng } from '../shared/rng';
import { createRng, nextRange } from '../shared/rng';

export const SCENARIO_KEY = 'pirate.scenario.v1';
const DEFAULT_SEED = 1;

export type Endpoint = 'ranking' | 'configs' | 'history' | 'write';
export type Dataset = 'fixtures' | 'empty' | 'bulk';

/** What the mock does with one request, decided before it touches the db. */
export interface RequestPlan {
  /** `infinite`: never answers (the client times out). */
  readonly latencyMs: number | 'infinite';
  readonly failure: { readonly status: number } | 'network' | null;
  /** Store the write, then never answer (lost response after a successful commit). */
  readonly hangAfterCommit: boolean;
}

/** Writes fail in `unavailable-then-recover` until this many attempts have failed. */
export const UNAVAILABLE_ATTEMPTS = 3;

const NORMAL_LATENCY = [40, 120] as const;
const VARIABLE_LATENCY = [50, 2000] as const;
const SLOW_MS = 2500;
const LATE_READ_MS = 1500;
const FAST_READ_MS = 30;

/**
 * Scenario state of the mock backend. The scenario survives reloads of the
 * tab (sessionStorage); `?scenario=` wins over the stored one. Latency comes
 * from a seeded RNG (`?seed=`), so test runs see the same delays.
 */
export class ScenarioState {
  #scenario: ScenarioName;
  #rng: Rng;
  #recovered = false;
  #failedWrites = 0;
  #reads = 0;
  readonly #committedOnce = new Set<string>();
  readonly #storage: () => KeyValueStorage | null;

  constructor(search: string, storage: () => KeyValueStorage | null) {
    this.#storage = storage;
    const params = new URLSearchParams(search);
    const fromUrl = params.get('scenario');
    const stored = readStored(storage(), SCENARIO_KEY);
    const fromStorage = stored.kind === 'ok' ? stored.value : null;
    this.#scenario = isScenarioName(fromUrl)
      ? fromUrl
      : isScenarioName(fromStorage)
        ? fromStorage
        : DEFAULT_SCENARIO;
    if (isScenarioName(fromUrl)) writeStored(storage(), SCENARIO_KEY, fromUrl);
    const seed = Number(params.get('seed'));
    this.#rng = createRng(Number.isFinite(seed) && seed !== 0 ? seed : DEFAULT_SEED);
  }

  get scenario(): ScenarioName {
    return this.#scenario;
  }

  get recovered(): boolean {
    return this.#recovered;
  }

  set(scenario: ScenarioName): void {
    this.#scenario = scenario;
    this.#recovered = false;
    this.#failedWrites = 0;
    this.#reads = 0;
    this.#committedOnce.clear();
    writeStored(this.#storage(), SCENARIO_KEY, scenario);
  }

  recover(): void {
    this.#recovered = true;
  }

  dataset(): Dataset {
    if (this.#scenario === 'empty') return 'empty';
    return this.#scenario === 'multi-page' ? 'bulk' : 'fixtures';
  }

  plan(endpoint: Endpoint, matchId?: string): RequestPlan {
    const ok = (latencyMs: number | 'infinite'): RequestPlan => ({
      latencyMs,
      failure: null,
      hangAfterCommit: false,
    });
    const fail = (failure: RequestPlan['failure']): RequestPlan => ({
      ...ok(this.#normalLatency()),
      failure,
    });
    const isRead = endpoint !== 'write';
    switch (this.#scenario) {
      case 'success':
      case 'empty':
      case 'multi-page':
        return ok(this.#normalLatency());
      case 'slow':
        return ok(SLOW_MS);
      case 'variable-latency':
        return ok(nextRange(this.#rng, VARIABLE_LATENCY[0], VARIABLE_LATENCY[1]));
      case 'out-of-order':
        if (!isRead) return ok(this.#normalLatency());
        this.#reads += 1;
        // Odd reads are late: a newer request overtakes them.
        return ok(this.#reads % 2 === 1 ? LATE_READ_MS : FAST_READ_MS);
      case 'timeout':
        return ok('infinite');
      case 'network-error':
        return fail('network');
      case 'http-400':
        return fail({ status: 400 });
      case 'http-500':
        return fail({ status: 500 });
      case 'ranking-fail':
        return endpoint === 'ranking' || endpoint === 'configs'
          ? fail({ status: 500 })
          : ok(this.#normalLatency());
      case 'history-fail':
        return endpoint === 'history' ? fail({ status: 500 }) : ok(this.#normalLatency());
      case 'write-timeout-after-commit':
        if (isRead || matchId === undefined || this.#committedOnce.has(matchId)) {
          return ok(this.#normalLatency());
        }
        this.#committedOnce.add(matchId);
        return { ...ok(this.#normalLatency()), hangAfterCommit: true };
      case 'unavailable-then-recover':
        if (isRead || this.#recovered) return ok(this.#normalLatency());
        this.#failedWrites += 1;
        if (this.#failedWrites > UNAVAILABLE_ATTEMPTS) {
          this.#recovered = true;
          return ok(this.#normalLatency());
        }
        return fail({ status: 503 });
      default:
        return assertNever(this.#scenario);
    }
  }

  #normalLatency(): number {
    return nextRange(this.#rng, NORMAL_LATENCY[0], NORMAL_LATENCY[1]);
  }
}
