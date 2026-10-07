/**
 * Live counts of the resources the game creates and must release on exit or
 * restart. Cheap integer bookkeeping, always on; read through the test hook
 * (`?test=1`) by the lifecycle e2e tests and the Phase 8 memory check.
 */
export const RESOURCE_KINDS = [
  'applications',
  'tickerCallbacks',
  'listeners',
  'observers',
  'dynamicTextures',
  'audioLoops',
] as const;

export type ResourceKind = (typeof RESOURCE_KINDS)[number];
export type ResourceCounts = Readonly<Record<ResourceKind, number>>;

const counts: Record<ResourceKind, number> = Object.fromEntries(
  RESOURCE_KINDS.map((kind) => [kind, 0]),
) as Record<ResourceKind, number>;

/** Counts one resource; the returned release function is idempotent. */
export function trackResource(kind: ResourceKind): () => void {
  counts[kind] += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    counts[kind] -= 1;
  };
}

export const resourceCounts = (): ResourceCounts => ({ ...counts });
