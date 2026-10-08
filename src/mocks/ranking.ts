import type {
  ConfigKey,
  MatchRecord,
  MatchSubmission,
  Page,
  RankedConfig,
  RankingEntry,
} from '../api/contracts';
import { configKeyOf, pageCount, parseConfigKey } from '../api/contracts';

/**
 * Pure query logic of the mock backend: ranking order, history order,
 * pagination and the ranked-config list. Deterministic for any input order.
 */

/** Ranking order: score desc → duration asc (faster wins) → played asc (earlier wins) → matchId. */
export const byRank = (a: MatchRecord, b: MatchRecord): number =>
  b.score - a.score ||
  a.durationMs - b.durationMs ||
  a.playedAt.localeCompare(b.playedAt) ||
  a.matchId.localeCompare(b.matchId);

/** History order: newest first, matchId as the tie-break. */
export const byNewest = (a: MatchRecord, b: MatchRecord): number =>
  b.playedAt.localeCompare(a.playedAt) || a.matchId.localeCompare(b.matchId);

export function paginate<T>(
  items: readonly T[],
  page: number,
  pageSize: number,
  revision: number,
): Page<T> {
  const totalPages = pageCount(items.length, pageSize);
  const current = Math.min(Math.max(1, Math.floor(page)), totalPages);
  return {
    items: items.slice((current - 1) * pageSize, current * pageSize),
    page: current,
    pageSize,
    totalItems: items.length,
    totalPages,
    revision,
  };
}

/** Only matches of the same config are compared; one entry per match. */
export function rankingOf(records: readonly MatchRecord[], configKey: ConfigKey): RankingEntry[] {
  return records
    .filter((record) => record.configKey === configKey)
    .sort(byRank)
    .map((record, index) => ({
      rank: index + 1,
      matchId: record.matchId,
      playerId: record.playerId,
      playerName: record.playerName,
      score: record.score,
      durationMs: record.durationMs,
      playedAt: record.playedAt,
    }));
}

export const historyOf = (records: readonly MatchRecord[], playerId: string): MatchRecord[] =>
  records.filter((record) => record.playerId === playerId).sort(byNewest);

/** Configs with records, shortest battles first. */
export function rankedConfigsOf(records: readonly MatchRecord[]): RankedConfig[] {
  const counts = new Map<ConfigKey, number>();
  for (const record of records) {
    counts.set(record.configKey, (counts.get(record.configKey) ?? 0) + 1);
  }
  return [...counts]
    .flatMap(([configKey, count]) => {
      const config = parseConfigKey(configKey);
      return config === null ? [] : [{ ...config, configKey, records: count }];
    })
    .sort(
      (a, b) =>
        a.sessionSeconds - b.sessionSeconds || a.spawnIntervalSeconds - b.spawnIntervalSeconds,
    );
}

export const toRecord = (match: MatchSubmission, recordedAt: string): MatchRecord => ({
  ...match,
  configKey: configKeyOf(match.config),
  recordedAt,
});

/** Same match: every submitted field equal (a resend of the byte-identical payload). */
export const isSameMatch = (a: MatchSubmission, b: MatchSubmission): boolean =>
  a.matchId === b.matchId &&
  a.playerId === b.playerId &&
  a.playerName === b.playerName &&
  a.playedAt === b.playedAt &&
  a.score === b.score &&
  a.durationMs === b.durationMs &&
  a.endReason === b.endReason &&
  a.config.sessionSeconds === b.config.sessionSeconds &&
  a.config.spawnIntervalSeconds === b.config.spawnIntervalSeconds;
