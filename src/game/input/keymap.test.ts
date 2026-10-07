import { describe, expect, it } from 'vitest';
import type { KeyEventLike } from './keymap';
import { HELD_ACTIONS, interpretKeyDown, KEY_BINDINGS } from './keymap';

const key = (code: string, extra: Partial<KeyEventLike> = {}): KeyEventLike => ({
  code,
  repeat: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  ...extra,
});

describe('keyboard mapping', () => {
  it('maps physical keys (KeyboardEvent.code) to the documented actions', () => {
    expect(interpretKeyDown(key('KeyW'), true)).toEqual({ kind: 'press', action: 'forward' });
    expect(interpretKeyDown(key('ArrowUp'), true)).toEqual({ kind: 'press', action: 'forward' });
    expect(interpretKeyDown(key('KeyA'), true)).toEqual({ kind: 'press', action: 'turnLeft' });
    expect(interpretKeyDown(key('ArrowRight'), true)).toEqual({
      kind: 'press',
      action: 'turnRight',
    });
    expect(interpretKeyDown(key('Space'), true)).toEqual({ kind: 'press', action: 'fireFront' });
    expect(interpretKeyDown(key('KeyQ'), true)).toEqual({ kind: 'press', action: 'fireLeft' });
    expect(interpretKeyDown(key('KeyL'), true)).toEqual({ kind: 'press', action: 'fireRight' });
    expect(interpretKeyDown(key('Escape'), true)).toEqual({ kind: 'command', command: 'pause' });
    expect(interpretKeyDown(key('KeyP'), true)).toEqual({ kind: 'command', command: 'pause' });
  });

  it('binds every held action to at least one key', () => {
    const bound = new Set(
      Object.values(KEY_BINDINGS).flatMap((b) => (b.kind === 'held' ? [b.action] : [])),
    );
    expect([...bound].sort()).toEqual([...HELD_ACTIONS].sort());
  });

  it('captures nothing outside active gameplay (menus, pause, end)', () => {
    expect(interpretKeyDown(key('Space'), false)).toEqual({ kind: 'ignore' });
    expect(interpretKeyDown(key('Escape'), false)).toEqual({ kind: 'ignore' });
  });

  it('leaves unbound keys and browser shortcuts alone', () => {
    expect(interpretKeyDown(key('KeyZ'), true)).toEqual({ kind: 'ignore' });
    expect(interpretKeyDown(key('Tab'), true)).toEqual({ kind: 'ignore' });
    expect(interpretKeyDown(key('KeyW', { ctrlKey: true }), true)).toEqual({ kind: 'ignore' });
    expect(interpretKeyDown(key('KeyR', { metaKey: true }), true)).toEqual({ kind: 'ignore' });
    expect(interpretKeyDown(key('KeyQ', { altKey: true }), true)).toEqual({ kind: 'ignore' });
  });

  it('swallows auto-repeat: it never presses again nor toggles pause', () => {
    expect(interpretKeyDown(key('KeyW', { repeat: true }), true)).toEqual({ kind: 'swallow' });
    expect(interpretKeyDown(key('Escape', { repeat: true }), true)).toEqual({ kind: 'swallow' });
  });
});
