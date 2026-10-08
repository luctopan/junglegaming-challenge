import type { AxiosInstance } from 'axios';
import axios from 'axios';
import type {
  ConfigKey,
  MatchRecord,
  MatchSubmission,
  Page,
  RankedConfig,
  RankingEntry,
} from './contracts';
import { ApiError, normalizeApiError } from './errors';
import { isListOf, isMatchRecord, isPageOf, isRankedConfig, isRankingEntry } from './guards';
import type { MockStatus, ScenarioName } from './scenarios';
import { isMockStatus } from './scenarios';

export const DEFAULT_API_TIMEOUT_MS = 8000;
const MIN_TIMEOUT_MS = 50;

/**
 * Client timeout: `VITE_API_TIMEOUT_MS` at build time and, in test mode only,
 * `?apiTimeout=<ms>`, so timeout scenarios run in a fraction of a second.
 */
export function apiTimeoutMs(search: string, testMode: boolean, configured?: string): number {
  const fromUrl = testMode ? new URLSearchParams(search).get('apiTimeout') : null;
  for (const candidate of [fromUrl, configured]) {
    if (candidate === null || candidate === undefined || candidate === '') continue;
    const value = Number(candidate);
    if (Number.isFinite(value) && value >= MIN_TIMEOUT_MS) return value;
  }
  return DEFAULT_API_TIMEOUT_MS;
}

/** What the server says about a PUT: a new record, or the identical one it already had. */
export type SubmitOutcome = 'created' | 'existing';

/**
 * Typed endpoints of the ranking/history API. Reads take the query's
 * AbortSignal, so a superseded request is cancelled at the network level and
 * never writes stale data; every body is validated against the contract.
 */
export interface ApiClient {
  rankingPage(
    configKey: ConfigKey,
    page: number,
    pageSize: number,
    signal?: AbortSignal,
  ): Promise<Page<RankingEntry>>;
  rankedConfigs(signal?: AbortSignal): Promise<readonly RankedConfig[]>;
  historyPage(
    playerId: string,
    page: number,
    pageSize: number,
    signal?: AbortSignal,
  ): Promise<Page<MatchRecord>>;
  submitMatch(match: MatchSubmission): Promise<SubmitOutcome>;
  /** Mock backend controls for the dev panel (served by MSW, never affected by scenarios). */
  readonly mock: {
    status(): Promise<MockStatus>;
    setScenario(scenario: ScenarioName): Promise<MockStatus>;
    recover(): Promise<MockStatus>;
    reset(): Promise<MockStatus>;
  };
}

const HTTP_CREATED = 201;

async function call<T>(
  request: () => Promise<{ data: unknown }>,
  isValid: (body: unknown) => body is T,
  what: string,
): Promise<T> {
  let body: unknown;
  try {
    body = (await request()).data;
  } catch (error) {
    throw normalizeApiError(error);
  }
  if (!isValid(body)) throw new ApiError('invalid', `Unexpected response from ${what}`);
  return body;
}

export function createApiClient(
  timeoutMs: number,
  http: AxiosInstance = axios.create(),
): ApiClient {
  http.defaults.baseURL = '/api';
  http.defaults.timeout = timeoutMs;
  const get = <T>(
    url: string,
    params: Record<string, string | number>,
    isValid: (body: unknown) => body is T,
    signal?: AbortSignal,
  ): Promise<T> =>
    call(() => http.get(url, signal === undefined ? { params } : { params, signal }), isValid, url);
  const mockCall = (method: 'get' | 'put' | 'post', url: string, body?: unknown) =>
    call(() => http.request({ method, url, data: body }), isMockStatus, url);

  return {
    rankingPage: (configKey, page, pageSize, signal) =>
      get('/ranking', { configKey, page, pageSize }, (b) => isPageOf(b, isRankingEntry), signal),
    rankedConfigs: (signal) => get('/ranking/configs', {}, isListOf(isRankedConfig), signal),
    historyPage: (playerId, page, pageSize, signal) =>
      get(
        `/players/${encodeURIComponent(playerId)}/matches`,
        { page, pageSize },
        (b) => isPageOf(b, isMatchRecord),
        signal,
      ),
    submitMatch: async (match) => {
      try {
        const response = await http.put(`/matches/${encodeURIComponent(match.matchId)}`, match);
        return response.status === HTTP_CREATED ? 'created' : 'existing';
      } catch (error) {
        throw normalizeApiError(error);
      }
    },
    mock: {
      status: () => mockCall('get', '/__mock/status'),
      setScenario: (scenario) => mockCall('put', '/__mock/scenario', { scenario }),
      recover: () => mockCall('post', '/__mock/recover'),
      reset: () => mockCall('post', '/__mock/reset'),
    },
  };
}
