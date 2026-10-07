import type { ShipKind } from '../../core';
import { damageStage } from '../../core';
import type { BarFill, HpBarArt } from '../theme';
import { HP_BARS, SHIP_ART } from '../theme';

/** Atlas frame for a ship of `kind` at damage `stage` (clamped to the stages the art has). */
export function shipFrame(kind: ShipKind, stage: number): string {
  const lastStage = SHIP_ART.stages - 1;
  const clamped = Math.min(lastStage, Math.max(0, Math.floor(stage)));
  return `ship_${SHIP_ART.colour[kind] + SHIP_ART.colours * clamped}`;
}

/** Visual damage stage from HP, using the match's frozen thresholds. */
export const shipStage = (hp: number, maxHp: number, thresholds: readonly number[]): number =>
  damageStage(hp, maxHp, thresholds);

export const hpBarArt = (kind: ShipKind): HpBarArt =>
  kind === 'player' ? HP_BARS.player : HP_BARS.enemy;

/** Fill colour frame for an HP ratio in [0, 1]: the first fill whose threshold the ratio exceeds. */
export function hpFill(art: HpBarArt, ratio: number): BarFill {
  const fallback = art.fills[art.fills.length - 1];
  // Theme bars always define at least one fill.
  if (fallback === undefined) throw new Error(`HP bar ${art.frame} has no fills`);
  return art.fills.find((fill) => ratio > fill.minRatio) ?? fallback;
}

/** HP ratio quantised to whole pixels of the fill, so bars only redraw on visible change. */
export function hpBarPixels(ratio: number, fillWidth: number): number {
  return Math.round(Math.min(1, Math.max(0, ratio)) * fillWidth);
}
