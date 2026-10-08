import type {
  ConfigKey,
  MatchRecord,
  MatchSubmission,
  Page,
  RankedConfig,
  RankingEntry,
} from '../../api/contracts';
import { configKeyOf, pageCount, parseConfigKey } from '../../api/contracts';

/**
 * TEMPORARY (Phase 4 only): in-memory ranking and history so the Captain's
 * Log can be built against the typed contracts before the API layer exists.
 * Phase 5 replaces this module with Axios + TanStack Query over MSW and
 * deletes it (scripts/lib/devOnly.mjs then fails a build that still has it).
 * No network code here.
 */

/** `demo` adds a filled match history; the others force a state (dev and test mode only). */
export type RecordsMode = 'live' | 'demo' | 'loading' | 'empty' | 'error';

const MODES: readonly RecordsMode[] = ['live', 'demo', 'loading', 'empty', 'error'];

/** `?records=<mode>`, honoured only when overrides are allowed (dev server, `?test=1`). */
export function recordsModeFrom(search: string, allowOverride: boolean): RecordsMode {
  const requested = new URLSearchParams(search).get('records');
  if (!allowOverride || requested === null) return 'live';
  return MODES.find((mode) => mode === requested) ?? 'live';
}

export interface RecordsContext {
  readonly mode: RecordsMode;
  /** The player's last completed match, shown in both tabs until real records exist. */
  readonly lastResult: MatchSubmission | null;
}

const LATENCY_MS = 150;
const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
/** Fixed fixture clock: stable dates, never `Date.now()`. */
const FIXTURE_EPOCH = Date.UTC(2026, 8, 8, 21, 42);

const CAPTAINS = [
  'Captain Flint',
  'Red Sparrow',
  'Storm Rider',
  'Sea Wolf',
  'Grey Gull',
  'Salty Meg',
  'Iron Hook',
  'Black Bess',
  'Tide Runner',
  'Old Barnacle',
  'Coral Queen',
  'Long John',
  'Mad Morgan',
];

interface FixtureSet {
  readonly config: { readonly sessionSeconds: number; readonly spawnIntervalSeconds: number };
  readonly scores: readonly number[];
}

const FIXTURE_SETS: readonly FixtureSet[] = [
  {
    config: { sessionSeconds: 120, spawnIntervalSeconds: 3 },
    scores: [38, 32, 21, 19, 17, 15, 15, 12, 11, 9, 7, 5, 3],
  },
  { config: { sessionSeconds: 60, spawnIntervalSeconds: 1 }, scores: [22, 18, 14, 9] },
  { config: { sessionSeconds: 180, spawnIntervalSeconds: 5 }, scores: [41, 33, 30, 26, 20, 8] },
];

const fixtureRecords: readonly MatchRecord[] = FIXTURE_SETS.flatMap(({ config, scores }, set) =>
  scores.map((score, index): MatchRecord => {
    const playedAt = new Date(
      FIXTURE_EPOCH - (set * DAY_MS + index * 26 * MINUTE_MS),
    ).toISOString();
    const durationMs = config.sessionSeconds * 1000 - (index % 3) * 9_000;
    return {
      matchId: `fixture-match-${set}-${index}`,
      // Never a UUID, so a fixture can never be the real player.
      playerId: `fixture-captain-${index}`,
      playerName: CAPTAINS[index % CAPTAINS.length] ?? 'Captain',
      playedAt,
      score,
      durationMs,
      endReason: index % 3 === 0 ? 'time_up' : 'defeated',
      config,
      configKey: configKeyOf(config),
      recordedAt: playedAt,
    };
  }),
);

const toRecord = (match: MatchSubmission): MatchRecord => ({
  ...match,
  configKey: configKeyOf(match.config),
  recordedAt: match.playedAt,
});

/** Battles of the current player for `?records=demo` (screenshots, manual review). */
function demoHistory(result: MatchSubmission): MatchRecord[] {
  const scores = [18, 22, 11, 20, 14, 9, 16];
  return scores.map((score, index) => {
    const playedAt = new Date(Date.parse(result.playedAt) - (index + 1) * 8 * MINUTE_MS);
    const defeated = index % 2 === 0;
    return toRecord({
      ...result,
      matchId: `demo-${index}`,
      playedAt: playedAt.toISOString(),
      score,
      durationMs: defeated ? 102_000 - index * 6_000 : result.config.sessionSeconds * 1000,
      endReason: defeated ? 'defeated' : 'time_up',
    });
  });
}

function allRecords(context: RecordsContext): MatchRecord[] {
  if (context.mode === 'empty') return [];
  const own = context.lastResult === null ? [] : [toRecord(context.lastResult)];
  const demo =
    context.mode === 'demo' && context.lastResult !== null ? demoHistory(context.lastResult) : [];
  return [...fixtureRecords, ...own, ...demo];
}

/** Deterministic ranking order: score desc → duration asc → played asc → matchId asc. */
const byRank = (a: MatchRecord, b: MatchRecord): number =>
  b.score - a.score ||
  a.durationMs - b.durationMs ||
  a.playedAt.localeCompare(b.playedAt) ||
  a.matchId.localeCompare(b.matchId);

function paginate<T>(items: readonly T[], page: number, pageSize: number): Page<T> {
  const totalPages = pageCount(items.length, pageSize);
  const current = Math.min(Math.max(1, page), totalPages);
  return {
    items: items.slice((current - 1) * pageSize, current * pageSize),
    page: current,
    pageSize,
    totalItems: items.length,
    totalPages,
    revision: 1,
  };
}

/** Resolves after a short simulated latency, like a network call would. */
function respond<T>(context: RecordsContext, signal: AbortSignal, value: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    if (context.mode === 'loading') return; // never settles: the loading state stays on screen
    const timer = setTimeout(() => {
      if (context.mode === 'error') reject(new Error('Records unavailable (temporary source)'));
      else resolve(value());
    }, LATENCY_MS);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason as Error);
    });
  });
}

export function fetchRankingPage(
  configKey: ConfigKey,
  page: number,
  pageSize: number,
  context: RecordsContext,
  signal: AbortSignal,
): Promise<Page<RankingEntry>> {
  return respond(context, signal, () => {
    const ranked = allRecords(context)
      .filter((record) => record.configKey === configKey)
      .sort(byRank)
      .map((record, index): RankingEntry => ({
        rank: index + 1,
        matchId: record.matchId,
        playerId: record.playerId,
        playerName: record.playerName,
        score: record.score,
        durationMs: record.durationMs,
        playedAt: record.playedAt,
      }));
    return paginate(ranked, page, pageSize);
  });
}

export function fetchHistoryPage(
  playerId: string,
  page: number,
  pageSize: number,
  context: RecordsContext,
  signal: AbortSignal,
): Promise<Page<MatchRecord>> {
  return respond(context, signal, () => {
    const mine = allRecords(context)
      .filter((record) => record.playerId === playerId)
      .sort((a, b) => b.playedAt.localeCompare(a.playedAt) || a.matchId.localeCompare(b.matchId));
    return paginate(mine, page, pageSize);
  });
}

/** Configs that have ranking records (the ranking's config selector). */
export function fetchRankedConfigs(
  context: RecordsContext,
  signal: AbortSignal,
): Promise<readonly RankedConfig[]> {
  return respond(context, signal, () => {
    const counts = new Map<ConfigKey, number>();
    for (const record of allRecords(context)) {
      counts.set(record.configKey, (counts.get(record.configKey) ?? 0) + 1);
    }
    return [...counts].flatMap(([configKey, records]) => {
      const config = parseConfigKey(configKey);
      return config === null ? [] : [{ ...config, configKey, records }];
    });
  });
}
