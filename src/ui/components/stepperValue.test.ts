import { describe, expect, it } from 'vitest';
import { OPTION_BOUNDS } from '../../config/options';
import { formatStepperValue, parseTypedValue, stepValue } from './stepperValue';

const session = OPTION_BOUNDS.sessionSeconds; // 60–180, step 10
const spawn = OPTION_BOUNDS.spawnIntervalSeconds; // 1–10, step 0.5

describe('stepValue', () => {
  it('steps on the grid and clamps to the bounds', () => {
    expect(stepValue(120, session, 1)).toBe(130);
    expect(stepValue(120, session, -1)).toBe(110);
    expect(stepValue(180, session, 1)).toBe(180);
    expect(stepValue(60, session, -5)).toBe(60);
    expect(stepValue(3, spawn, 1)).toBe(3.5);
    expect(stepValue(1, spawn, -1)).toBe(1);
  });

  it('never leaks float noise (0.1 + 0.2 style)', () => {
    let value = 1;
    for (let i = 0; i < 18; i++) value = stepValue(value, spawn, 1);
    expect(value).toBe(10);
  });

  it('jumps to the ends with large steps (Home/End, PageUp/PageDown)', () => {
    expect(stepValue(120, session, Number.POSITIVE_INFINITY)).toBe(180);
    expect(stepValue(120, session, Number.NEGATIVE_INFINITY)).toBe(60);
  });
});

describe('parseTypedValue', () => {
  it('accepts numbers with or without the unit and a decimal comma', () => {
    expect(parseTypedValue('90', session)).toEqual({ ok: true, value: 90 });
    expect(parseTypedValue(' 150 s ', session)).toEqual({ ok: true, value: 150 });
    expect(parseTypedValue('2,5', spawn)).toEqual({ ok: true, value: 2.5 });
  });

  it('rejects out-of-range, off-grid and non-numeric input with the limits', () => {
    for (const text of ['500', '55', '125', '']) {
      const result = parseTypedValue(text, session);
      expect(result, text).toMatchObject({ ok: false });
      if (!result.ok) expect(result.message).toContain('between 60 and 180');
    }
    expect(parseTypedValue('0', spawn)).toMatchObject({ ok: false });
    expect(parseTypedValue('1.2', spawn)).toMatchObject({ ok: false });
    expect(parseTypedValue('-3', spawn)).toMatchObject({ ok: false });
    expect(parseTypedValue('abc', spawn)).toMatchObject({ ok: false });
  });
});

describe('formatStepperValue', () => {
  it('shows decimals only when needed', () => {
    expect(formatStepperValue(120, session)).toBe('120');
    expect(formatStepperValue(3, spawn)).toBe('3');
    expect(formatStepperValue(2.5, spawn)).toBe('2.5');
  });
});
