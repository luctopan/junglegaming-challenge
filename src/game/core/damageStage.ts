/**
 * Visual deterioration stage from HP: 0 = intact, one more stage per threshold
 * the HP ratio has fallen to, and `thresholds.length + 1` once destroyed (wreck).
 */
export function damageStage(hp: number, maxHp: number, thresholds: readonly number[]): number {
  if (hp <= 0) return thresholds.length + 1;
  const ratio = hp / maxHp;
  return thresholds.filter((t) => ratio <= t).length;
}
