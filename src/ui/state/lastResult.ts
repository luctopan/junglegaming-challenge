import type { EndReason, MatchSubmission } from '../../api/contracts';
import { OPTION_BOUNDS, isWithinBounds } from '../../config/options';

const END_REASONS: readonly EndReason[] = ['time_up', 'defeated'];

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';

/**
 * Validates the stored last result (untrusted). It is the match exactly as it
 * will be submitted (Phase 5), so the same shape serves the Result screen.
 */
export function parseMatchSubmission(stored: unknown): MatchSubmission | null {
  if (typeof stored !== 'object' || stored === null) return null;
  const record = stored as Partial<Record<keyof MatchSubmission, unknown>>;
  const { matchId, playerId, playerName, playedAt, score, durationMs, endReason, config } = record;
  if (!isText(matchId) || !isText(playerId) || !isText(playerName) || !isText(playedAt)) {
    return null;
  }
  if (Number.isNaN(Date.parse(playedAt))) return null;
  if (!isNonNegativeInteger(score) || !isNonNegativeInteger(durationMs)) return null;
  if (!END_REASONS.includes(endReason as EndReason)) return null;
  if (typeof config !== 'object' || config === null) return null;
  const { sessionSeconds, spawnIntervalSeconds } = config as Partial<Record<string, unknown>>;
  if (
    typeof sessionSeconds !== 'number' ||
    typeof spawnIntervalSeconds !== 'number' ||
    !isWithinBounds(sessionSeconds, OPTION_BOUNDS.sessionSeconds) ||
    !isWithinBounds(spawnIntervalSeconds, OPTION_BOUNDS.spawnIntervalSeconds)
  ) {
    return null;
  }
  return {
    matchId,
    playerId,
    playerName,
    playedAt,
    score,
    durationMs,
    endReason: endReason as EndReason,
    config: { sessionSeconds, spawnIntervalSeconds },
  };
}
