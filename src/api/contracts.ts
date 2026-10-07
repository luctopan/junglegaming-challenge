/**
 * Typed contracts of the ranking and match-history API (docs/PLAN.md §3.1).
 * Shared by the UI, the API client (Phase 5) and the MSW handlers (Phase 6).
 */

export type EndReason = 'time_up' | 'defeated';

/** The two player options a match was played with; ranking only compares equal configs. */
export interface MatchConfigRef {
  readonly sessionSeconds: number;
  readonly spawnIntervalSeconds: number;
}

/** e.g. `"120s-3s"`, `"90s-1.5s"`. */
export type ConfigKey = `${number}s-${number}s`;

/** A completed match as the client registers it (idempotent by `matchId`). */
export interface MatchSubmission {
  readonly matchId: string;
  readonly playerId: string;
  /** Captain name at the time of the match (display only; ownership is `playerId`). */
  readonly playerName: string;
  /** ISO date, fixed when the match ended so every resubmission is byte-identical. */
  readonly playedAt: string;
  readonly score: number;
  /** Effective (unpaused) play time. */
  readonly durationMs: number;
  readonly endReason: EndReason;
  readonly config: MatchConfigRef;
}

export interface MatchRecord extends MatchSubmission {
  readonly configKey: ConfigKey;
  readonly recordedAt: string;
}

export interface Page<T> {
  readonly items: readonly T[];
  /** 1-based. */
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
  /** Server data version; a response older than the cached one is ignored. */
  readonly revision: number;
}

export interface RankingEntry {
  readonly rank: number;
  readonly matchId: string;
  readonly playerId: string;
  readonly playerName: string;
  readonly score: number;
  readonly durationMs: number;
  readonly playedAt: string;
}

/** A config that has ranking records, for the ranking config selector. */
export interface RankedConfig extends MatchConfigRef {
  readonly configKey: ConfigKey;
  readonly records: number;
}

export const configKeyOf = (config: MatchConfigRef): ConfigKey =>
  `${config.sessionSeconds}s-${config.spawnIntervalSeconds}s`;

const CONFIG_KEY_PATTERN = /^(\d+(?:\.\d+)?)s-(\d+(?:\.\d+)?)s$/;

/** Inverse of `configKeyOf`; null for anything else (e.g. a hand-edited URL). */
export function parseConfigKey(key: string): MatchConfigRef | null {
  const match = CONFIG_KEY_PATTERN.exec(key);
  if (match === null) return null;
  return { sessionSeconds: Number(match[1]), spawnIntervalSeconds: Number(match[2]) };
}

export const PAGE_SIZE = 5;

/** Total pages of a list, at least 1 (an empty list still shows "page 1 of 1"). */
export const pageCount = (totalItems: number, pageSize: number): number =>
  Math.max(1, Math.ceil(totalItems / pageSize));
