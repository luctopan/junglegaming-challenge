import type { OptionBounds } from '../../config/options';
import { describeBounds, isWithinBounds } from '../../config/options';

/** Decimal places of the step (0.5 → 1), so float noise never reaches the screen or storage. */
const decimalsOf = (step: number): number => (String(step).split('.')[1] ?? '').length;

const roundTo = (value: number, decimals: number): number => Number(value.toFixed(decimals));

/** Moves `steps` grid steps from `value`, snapped to the grid and clamped to the bounds. */
export function stepValue(value: number, bounds: OptionBounds, steps: number): number {
  const { min, max, step } = bounds;
  const index = Math.round((value - min) / step) + steps;
  const maxIndex = Math.round((max - min) / step);
  const clamped = Math.min(maxIndex, Math.max(0, index));
  return roundTo(min + clamped * step, decimalsOf(step));
}

export type TypedValue =
  { readonly ok: true; readonly value: number } | { readonly ok: false; readonly message: string };

/**
 * Parses what the player typed in a spinbutton: a number, optionally with the
 * unit ("90", "90 s", "1,5"). Out-of-bounds or off-grid values are rejected
 * with the documented limits, never silently clamped.
 */
export function parseTypedValue(text: string, bounds: OptionBounds): TypedValue {
  const cleaned = text.trim().replace(/\s*s$/i, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    return { ok: false, message: `Enter a number. ${describeBounds(bounds)}` };
  }
  const value = Number(cleaned);
  if (!isWithinBounds(value, bounds)) return { ok: false, message: describeBounds(bounds) };
  return { ok: true, value: roundTo(value, decimalsOf(bounds.step)) };
}

/** Value as shown in the field, without the unit ("120", "1.5"). */
export const formatStepperValue = (value: number, bounds: OptionBounds): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(decimalsOf(bounds.step));
