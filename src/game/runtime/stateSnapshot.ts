import type { SessionPhase, PauseReason } from '../bridge/gameStore';
import type { CannonKind, EndReason, EnemyKind, Team, WeaponSlot, World } from '../core';
import { getPlayer, timeLeftSeconds } from '../core';

/**
 * Plain-JSON view of a running session for the e2e suite (`snapshot()` on
 * the test hook). Read-only by construction: it is a copy.
 */
export interface StateSnapshot {
  readonly phase: SessionPhase;
  readonly pauseReason: PauseReason | null;
  readonly endReason: EndReason | null;
  readonly stepCount: number;
  readonly elapsedSeconds: number;
  readonly timeLeftSeconds: number;
  readonly score: number;
  readonly player: {
    readonly x: number;
    readonly y: number;
    /** Radians, 0 = east, y down. */
    readonly heading: number;
    readonly speed: number;
    readonly hp: number;
    readonly maxHp: number;
    readonly alive: boolean;
    readonly cooldowns: Readonly<Record<WeaponSlot, number>>;
  };
  readonly enemies: readonly {
    readonly id: number;
    readonly kind: EnemyKind;
    readonly x: number;
    readonly y: number;
    readonly hp: number;
    readonly alive: boolean;
  }[];
  readonly projectiles: readonly {
    readonly team: Team;
    readonly cannon: CannonKind;
    readonly x: number;
    readonly y: number;
  }[];
  /** True when no player input is held or latched (e.g. right after a pause). */
  readonly inputIdle: boolean;
}

export function snapshotState(
  world: World,
  phase: SessionPhase,
  pauseReason: PauseReason | null,
  inputIdle: boolean,
): StateSnapshot {
  const player = getPlayer(world);
  return {
    phase,
    pauseReason,
    endReason: world.endReason,
    stepCount: world.stepCount,
    elapsedSeconds: world.elapsedSeconds,
    timeLeftSeconds: timeLeftSeconds(world),
    score: world.score,
    player: {
      x: player.pos.x,
      y: player.pos.y,
      heading: player.heading,
      speed: player.speed,
      hp: player.hp,
      maxHp: player.maxHp,
      alive: player.alive,
      cooldowns: { ...player.cooldowns },
    },
    enemies: world.ships.flatMap((ship) =>
      ship.kind === 'player'
        ? []
        : [
            {
              id: ship.id,
              kind: ship.kind,
              x: ship.pos.x,
              y: ship.pos.y,
              hp: ship.hp,
              alive: ship.alive,
            },
          ],
    ),
    projectiles: world.projectiles
      .filter((ball) => ball.alive)
      .map((ball) => ({ team: ball.team, cannon: ball.cannon, x: ball.pos.x, y: ball.pos.y })),
    inputIdle,
  };
}
