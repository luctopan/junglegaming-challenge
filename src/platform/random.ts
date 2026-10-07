/** Fresh 32-bit match seed from the platform CSPRNG (the simulation itself only uses its seeded RNG). */
export function randomSeed(): number {
  const [seed = 0] = crypto.getRandomValues(new Uint32Array(1));
  return seed;
}
