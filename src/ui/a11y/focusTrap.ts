/** Elements a keyboard user can Tab to, in the order the browser visits them (no positive tabindex is used). */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function focusableIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => !element.closest('[inert]') && element.getClientRects().length > 0,
  );
}

/**
 * Where Tab should go inside a trap: wraps from the last element to the first
 * (and back with Shift), or pulls focus in when it is outside. Returns null
 * when the browser's own move stays inside the trap.
 */
export function wrapTarget<T>(
  focusables: readonly T[],
  current: T | null,
  backwards: boolean,
): T | null {
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (first === undefined || last === undefined) return null;
  const index = current === null ? -1 : focusables.indexOf(current);
  if (index === -1) return backwards ? last : first;
  if (backwards && index === 0) return last;
  if (!backwards && index === focusables.length - 1) return first;
  return null;
}
