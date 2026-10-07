/**
 * Seeded PRNG (mulberry32). The state is a plain object so it can live inside a
 * serializable simulation snapshot; every draw advances it in place.
 */
export interface Rng {
  state: number;
}

const GOLDEN_GAMMA = 0x6d2b79f5;
const UINT32_RANGE = 2 ** 32;

export const createRng = (seed: number): Rng => ({ state: seed >>> 0 });

/** Uniform float in [0, 1). */
export function nextFloat(rng: Rng): number {
  rng.state = (rng.state + GOLDEN_GAMMA) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
}

/** Uniform float in [min, max). */
export const nextRange = (rng: Rng, min: number, max: number): number =>
  min + (max - min) * nextFloat(rng);

/**
 * Picks a key with probability proportional to its weight. `order` fixes the
 * iteration order so the result never depends on object key ordering.
 */
export function pickWeighted<K extends string>(
  rng: Rng,
  weights: Readonly<Record<K, number>>,
  order: readonly K[],
): K {
  const total = order.reduce((sum, key) => sum + weights[key], 0);
  if (!(total > 0)) throw new Error('pickWeighted: weights must sum to a positive number');
  let roll = nextFloat(rng) * total;
  for (const key of order) {
    roll -= weights[key];
    if (roll < 0) return key;
  }
  // Float rounding can leave roll at ~0 after the last subtraction: fall back to
  // the last key that can be picked at all.
  for (let i = order.length - 1; i >= 0; i--) {
    const key = order[i];
    if (key !== undefined && weights[key] > 0) return key;
  }
  throw new Error('pickWeighted: no positive weight');
}
