import type { GameConfig } from '../../../config/gameConfig';
import { createMatch } from '../createMatch';
import { getPlayer } from '../ships';
import { step } from '../step';
import type { EndReason, EnemyKind } from '../types';
import { scriptedBotInput } from './scriptedBot';

export interface BalanceSample {
  readonly seed: number;
  readonly durationSeconds: number;
  readonly score: number;
  readonly endReason: EndReason;
  readonly finalHp: number;
  readonly spawnedByKind: Readonly<Record<EnemyKind, number>>;
}

/** Plays one full headless match with the scripted bot (used by `pnpm balance`). */
export function playBalanceMatch(config: GameConfig, seed: number): BalanceSample {
  const world = createMatch(config, seed);
  while (world.phase === 'running') step(world, scriptedBotInput(world));
  if (world.endReason === null) throw new Error('match ended without a reason');
  return {
    seed,
    durationSeconds: world.elapsedSeconds,
    score: world.score,
    endReason: world.endReason,
    finalHp: getPlayer(world).hp,
    spawnedByKind: { ...world.spawner.spawnedByKind },
  };
}
