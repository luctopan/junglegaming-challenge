import { describe, expect, it } from 'vitest';
import { formatClock } from './formatClock';

describe('formatClock', () => {
  it('formats whole seconds as m:ss, rounding up', () => {
    expect(formatClock(120)).toBe('2:00');
    expect(formatClock(61)).toBe('1:01');
    expect(formatClock(9.2)).toBe('0:10');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(-3)).toBe('0:00');
  });
});
