import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG } from '../../../config/defaults';
import { createMatch } from '../createMatch';
import type { DomainEvent } from '../events';
import { step } from '../step';
import type { WeaponSlot } from '../types';
import { circleRoundedRectPushOut } from '../geometry';
import { getPlayer, hullCircles, hullRadius } from '../ships';
import type { BotProfile } from './bots';
import { BOT_PROFILES } from './bots';
import { skilledBotInput, weaponBears } from './skilledBot';

const SLOTS: readonly WeaponSlot[] = ['front', 'left', 'right'];
const SEEDS = Array.from({ length: 10 }, (_, i) => i + 1);
/** A hull circle within this distance of an island counts as hugging the shore. */
const SHORE_MARGIN = 1;
/** 20 full matches (~90 s simulated each); slower than the default timeout under coverage. */
const FULL_MATCHES_TIMEOUT_MS = 30_000;

function shoreContactShare(profile: BotProfile): number {
  let steps = 0;
  let shoreSteps = 0;
  for (const seed of SEEDS) {
    const world = createMatch(DEFAULT_GAME_CONFIG, seed);
    while (world.phase === 'running') {
      step(world, BOT_PROFILES[profile](world));
      const player = getPlayer(world);
      const reach = hullRadius(world, player) + SHORE_MARGIN;
      steps += 1;
      if (
        hullCircles(world, player).some((c) =>
          world.arena.islandRects.some((r) => circleRoundedRectPushOut(c, reach, r)),
        )
      ) {
        shoreSteps += 1;
      }
    }
  }
  return shoreSteps / steps;
}

describe('skilled bot', () => {
  it('is deterministic: same seed → identical match', () => {
    const play = (): DomainEvent[] => {
      const world = createMatch(DEFAULT_GAME_CONFIG, 21);
      const events: DomainEvent[] = [];
      while (world.phase === 'running') events.push(...step(world, skilledBotInput(world)));
      return events;
    };
    expect(play()).toEqual(play());
  });

  it('fires a weapon only while it bears on an enemy', () => {
    const world = createMatch(DEFAULT_GAME_CONFIG, 4);
    let shots = 0;
    while (world.phase === 'running') {
      // The bot decides from the world before the step, exactly like this check.
      const bearing = new Map(SLOTS.map((slot) => [slot, weaponBears(world, slot)]));
      const input = skilledBotInput(world);
      for (const event of step(world, input)) {
        if (event.type !== 'shotFired' || event.shipId !== world.playerId) continue;
        shots += 1;
        expect(bearing.get(event.slot)).toBe(true);
      }
    }
    expect(shots).toBeGreaterThan(5);
  });

  // Survival is NOT asserted: with the default config both bots last about as long,
  // because Shooter fire (which neither bot dodges) dominates (docs/DECISIONS.md S17).
  it(
    'hugs island shores far less than the naive bot',
    () => {
      // Chaser rams are not compared any more: since rounded island corners
      // (DECISIONS R4) stopped trapping the naive bot on shores, the two bots'
      // ram rates swing either way with small geometry changes.
      expect(shoreContactShare('skilled')).toBeLessThan(shoreContactShare('naive') / 2);
    },
    FULL_MATCHES_TIMEOUT_MS,
  );
});
