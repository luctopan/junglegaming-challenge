/** Deeply immutable view of a plain-data type. */
export type DeepReadonly<T> = T extends (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

/**
 * Deep-clones plain data (objects, arrays, primitives) and freezes the copy, so a
 * snapshot can never be changed through the original or the copy.
 */
export function cloneDeepFrozen<T>(value: T): DeepReadonly<T> {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item: unknown) => cloneDeepFrozen(item))) as DeepReadonly<T>;
  }
  if (value !== null && typeof value === 'object') {
    const copy: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) copy[key] = cloneDeepFrozen(item);
    return Object.freeze(copy) as DeepReadonly<T>;
  }
  return value as DeepReadonly<T>;
}
