/**
 * Object pool for display objects that come and go every few frames
 * (projectiles, effects, ship views): released items are hidden and reused
 * instead of being destroyed and re-created, which avoids GC churn and GPU
 * buffer reallocation during combat.
 */
export interface Pool<T> {
  acquire(): T;
  release(item: T): void;
  /** Items currently handed out. */
  readonly active: number;
  /** Items created so far (active + idle). */
  readonly created: number;
  /** Destroys every item, active or idle. The pool must not be used afterwards. */
  destroy(): void;
}

export interface PoolOptions<T> {
  readonly create: () => T;
  /** Prepares a released item for reuse (hide it, reset its state). */
  readonly reset: (item: T) => void;
  readonly dispose: (item: T) => void;
}

export function createPool<T>({ create, reset, dispose }: PoolOptions<T>): Pool<T> {
  const idle: T[] = [];
  const all = new Set<T>();
  const inUse = new Set<T>();

  return {
    acquire(): T {
      const item = idle.pop() ?? create();
      all.add(item);
      inUse.add(item);
      return item;
    },
    release(item: T): void {
      // Releasing twice would hand the same object out to two owners.
      if (!inUse.delete(item)) return;
      reset(item);
      idle.push(item);
    },
    get active() {
      return inUse.size;
    },
    get created() {
      return all.size;
    },
    destroy(): void {
      for (const item of all) dispose(item);
      all.clear();
      inUse.clear();
      idle.length = 0;
    },
  };
}
