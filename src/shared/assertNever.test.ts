import { describe, expect, it } from 'vitest';
import { assertNever } from './assertNever';

type Shape = { kind: 'circle' } | { kind: 'rect' };

function describeShape(shape: Shape): string {
  switch (shape.kind) {
    case 'circle':
      return 'round';
    case 'rect':
      return 'square';
    default:
      return assertNever(shape, 'shape');
  }
}

describe('assertNever', () => {
  it('is never reached for handled variants', () => {
    expect(describeShape({ kind: 'circle' })).toBe('round');
    expect(describeShape({ kind: 'rect' })).toBe('square');
  });

  it('throws with context when an unexpected value slips through at runtime', () => {
    const rogue = { kind: 'triangle' } as unknown as never;
    expect(() => assertNever(rogue, 'shape')).toThrow('Unexpected shape: {"kind":"triangle"}');
  });
});
