import type {
  EndReason,
  MatchConfigRef,
  MatchRecord,
  Page,
  RankedConfig,
  RankingEntry,
} from './contracts';
import { configKeyOf } from './contracts';

/**
 * Small hand-written guards for response bodies (no schema library: the
 * contract is tiny). A body that fails them becomes an `invalid` ApiError.
 */
type Fields = Partial<Record<string, unknown>>;

const isObject = (value: unknown): value is Fields => typeof value === 'object' && value !== null;
const isString = (value: unknown): value is string => typeof value === 'string';
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;
const isDate = (value: unknown): value is string =>
  isString(value) && !Number.isNaN(Date.parse(value));
const isEndReason = (value: unknown): value is EndReason =>
  value === 'time_up' || value === 'defeated';

export function isMatchConfigRef(value: unknown): value is MatchConfigRef {
  return (
    isObject(value) &&
    typeof value.sessionSeconds === 'number' &&
    typeof value.spawnIntervalSeconds === 'number'
  );
}

export function isRankingEntry(value: unknown): value is RankingEntry {
  return (
    isObject(value) &&
    isCount(value.rank) &&
    isString(value.matchId) &&
    isString(value.playerId) &&
    isString(value.playerName) &&
    isCount(value.score) &&
    isCount(value.durationMs) &&
    isDate(value.playedAt)
  );
}

export function isMatchRecord(value: unknown): value is MatchRecord {
  return (
    isObject(value) &&
    isString(value.matchId) &&
    isString(value.playerId) &&
    isString(value.playerName) &&
    isDate(value.playedAt) &&
    isCount(value.score) &&
    isCount(value.durationMs) &&
    isEndReason(value.endReason) &&
    isMatchConfigRef(value.config) &&
    value.configKey === configKeyOf(value.config) &&
    isDate(value.recordedAt)
  );
}

export function isRankedConfig(value: unknown): value is RankedConfig {
  return (
    isMatchConfigRef(value) &&
    isObject(value) &&
    value.configKey === configKeyOf(value) &&
    isCount(value.records)
  );
}

export function isPageOf<T>(
  value: unknown,
  isItem: (item: unknown) => item is T,
): value is Page<T> {
  return (
    isObject(value) &&
    Array.isArray(value.items) &&
    value.items.every(isItem) &&
    isCount(value.page) &&
    isCount(value.pageSize) &&
    isCount(value.totalItems) &&
    isCount(value.totalPages) &&
    isCount(value.revision)
  );
}

export const isListOf =
  <T>(isItem: (item: unknown) => item is T) =>
  (value: unknown): value is readonly T[] =>
    Array.isArray(value) && value.every(isItem);
