import type { GameConfig } from '../../../config/gameConfig';
import { createMatch } from '../createMatch';
import { getPlayer } from '../ships';
import { step } from '../step';
import type { EndReason, EnemyKind } from '../types';
import type { BotProfile } from './bots';
import { BOT_PROFILES } from './bots';

export interface BalanceSample {
  readonly seed: number;
  readonly profile: BotProfile;
  readonly durationSeconds: number;
  readonly score: number;
  readonly endReason: EndReason;
  readonly finalHp: number;
  readonly spawnedByKind: Readonly<Record<EnemyKind, number>>;
}

/** Plays one full headless match with a scripted bot (used by `pnpm balance`). */
export function playBalanceMatch(
  config: GameConfig,
  seed: number,
  profile: BotProfile,
): BalanceSample {
  const world = createMatch(config, seed);
  const bot = BOT_PROFILES[profile];
  while (world.phase === 'running') step(world, bot(world));
  if (world.endReason === null) throw new Error('match ended without a reason');
  return {
    seed,
    profile,
    durationSeconds: world.elapsedSeconds,
    score: world.score,
    endReason: world.endReason,
    finalHp: getPlayer(world).hp,
    spawnedByKind: { ...world.spawner.spawnedByKind },
  };
}
