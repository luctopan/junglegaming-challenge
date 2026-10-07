/**
 * How many times selected React components committed, read by the e2e suite
 * through the test hook to prove the HUD follows the bridge store (about once
 * per second) and never renders per frame. Cheap integer bookkeeping, always on.
 */
const counts = new Map<string, number>();

export function countCommit(name: string): void {
  counts.set(name, (counts.get(name) ?? 0) + 1);
}

export const commitCount = (name: string): number => counts.get(name) ?? 0;
