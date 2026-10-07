import { describe, expect, it } from 'vitest';
import { KEY_BINDINGS } from '../../game/runtime/controls';
import { CONTROL_ROWS, keyName, keysByAction } from './controlsHelp';

describe('controls help', () => {
  it('names keys the way players read them', () => {
    expect(keyName('KeyW')).toBe('W');
    expect(keyName('ArrowLeft')).toBe('←');
    expect(keyName('Space')).toBe('Space');
    expect(keyName('Escape')).toBe('Esc');
  });

  it('lists every key of the real key map under its action', () => {
    const keys = keysByAction(KEY_BINDINGS);
    expect(keys.forward).toEqual(['W', '↑']);
    expect(keys.fireLeft).toEqual(['Q', 'J']);
    expect(keys.pause).toEqual(['P', 'Esc']);
    const listed = Object.values(keys).flat().length;
    expect(listed).toBe(Object.keys(KEY_BINDINGS).length);
  });

  it('has a help row for every action', () => {
    expect(CONTROL_ROWS.map((row) => row.action).sort()).toEqual(
      Object.keys(keysByAction(KEY_BINDINGS)).sort(),
    );
  });
});
