import { describe, expect, it } from 'vitest';
import { wrapTarget } from './focusTrap';

describe('wrapTarget', () => {
  const items = ['a', 'b', 'c'];

  it('wraps at both ends', () => {
    expect(wrapTarget(items, 'c', false)).toBe('a');
    expect(wrapTarget(items, 'a', true)).toBe('c');
  });

  it('lets the browser move focus inside the trap', () => {
    expect(wrapTarget(items, 'a', false)).toBeNull();
    expect(wrapTarget(items, 'b', true)).toBeNull();
  });

  it('pulls focus back in from outside', () => {
    expect(wrapTarget(items, null, false)).toBe('a');
    expect(wrapTarget(items, 'outside', true)).toBe('c');
  });

  it('does nothing without focusable elements', () => {
    expect(wrapTarget([], null, false)).toBeNull();
  });
});
