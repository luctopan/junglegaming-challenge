import { describe, expect, it } from 'vitest';
import { parseCaptainProfile, validateCaptainName } from './captainName';

const ID = '3f2b8c1e-4a5d-4e6f-9a0b-1c2d3e4f5a6b';

describe('validateCaptainName', () => {
  it('accepts letters, digits, spaces, apostrophes and hyphens, trimmed', () => {
    expect(validateCaptainName('  Captain Jack  ')).toEqual({ ok: true, name: 'Captain Jack' });
    expect(validateCaptainName("O'Brien-2")).toEqual({ ok: true, name: "O'Brien-2" });
    expect(validateCaptainName('João')).toEqual({ ok: true, name: 'João' });
    // Decomposed input (combining tilde) is stored composed and counted as one character.
    expect(validateCaptainName('João')).toEqual({ ok: true, name: 'João' });
    expect(validateCaptainName('é'.repeat(20))).toMatchObject({ ok: true });
  });

  it('enforces 2–20 characters after trimming', () => {
    expect(validateCaptainName('  J ')).toMatchObject({ ok: false, error: 'tooShort' });
    expect(validateCaptainName('')).toMatchObject({ ok: false, error: 'tooShort' });
    expect(validateCaptainName('Jo')).toMatchObject({ ok: true });
    expect(validateCaptainName('a'.repeat(20))).toMatchObject({ ok: true });
    expect(validateCaptainName('a'.repeat(21))).toMatchObject({ ok: false, error: 'tooLong' });
  });

  it('rejects other characters with a readable message', () => {
    for (const name of ['Jack!', 'Jack_Sparrow', '<b>Jack</b>', 'Jack\tSparrow', 'Ja😀ck']) {
      const result = validateCaptainName(name);
      expect(result, name).toMatchObject({ ok: false, error: 'invalidCharacters' });
      if (!result.ok) expect(result.message).toMatch(/letters, numbers/);
    }
  });
});

describe('parseCaptainProfile', () => {
  it('accepts a valid stored profile', () => {
    expect(parseCaptainProfile({ playerId: ID, name: 'Red Sparrow' })).toEqual({
      playerId: ID,
      name: 'Red Sparrow',
    });
  });

  it('rejects corrupted or edited data', () => {
    for (const stored of [
      null,
      'Jack',
      {},
      { playerId: ID },
      { playerId: 'fixture-1', name: 'Jack' },
      { playerId: ID, name: ' Jack' },
      { playerId: ID, name: 'J' },
      { playerId: ID, name: 42 },
    ]) {
      expect(parseCaptainProfile(stored), JSON.stringify(stored)).toBeNull();
    }
  });
});
