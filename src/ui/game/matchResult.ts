import type { MatchSubmission } from '../../api/contracts';
import type { GameConfig } from '../../config/gameConfig';
import type { MatchSnapshot } from '../../game/bridge/gameStore';
import type { CaptainProfile } from '../profile/captainName';

interface MatchIdentity {
  readonly matchId: string;
  readonly captain: CaptainProfile;
  /** The config snapshot the match was played with. */
  readonly config: GameConfig;
}

/**
 * The finished match as it will be recorded: built once, when the match
 * ends, so `playedAt` is fixed and every later resubmission is identical.
 * Null while the match is still running.
 */
export function buildMatchResult(
  match: MatchSnapshot,
  identity: MatchIdentity,
  endedAt: Date,
): MatchSubmission | null {
  if (match.endReason === null || match.durationMs === null) return null;
  return {
    matchId: identity.matchId,
    playerId: identity.captain.playerId,
    playerName: identity.captain.name,
    playedAt: endedAt.toISOString(),
    score: match.score,
    durationMs: match.durationMs,
    endReason: match.endReason,
    config: {
      sessionSeconds: identity.config.match.sessionSeconds,
      spawnIntervalSeconds: identity.config.spawn.intervalSeconds,
    },
  };
}
