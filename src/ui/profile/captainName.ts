/**
 * The player's captain identity. `playerId` (UUID) owns history and ranking
 * rows; the name is display data only, so renaming never breaks ownership.
 */
export interface CaptainProfile {
  readonly playerId: string;
  readonly name: string;
}

export const CAPTAIN_NAME_MIN = 2;
export const CAPTAIN_NAME_MAX = 20;

/** Letters (with their combining marks) and digits of any script, spaces, apostrophes, hyphens. */
const ALLOWED = /^[\p{L}\p{M}\p{N} '-]+$/u;

const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' });

export type CaptainNameError = 'tooShort' | 'tooLong' | 'invalidCharacters';

export type CaptainNameResult =
  | { readonly ok: true; readonly name: string }
  | { readonly ok: false; readonly error: CaptainNameError; readonly message: string };

const MESSAGES: Readonly<Record<CaptainNameError, string>> = {
  tooShort: `Enter at least ${CAPTAIN_NAME_MIN} characters.`,
  tooLong: `Use at most ${CAPTAIN_NAME_MAX} characters.`,
  invalidCharacters: "Use only letters, numbers, spaces, apostrophes (') and hyphens (-).",
};

const fail = (error: CaptainNameError): CaptainNameResult => ({
  ok: false,
  error,
  message: MESSAGES[error],
});

/**
 * Validates what the player typed. Surrounding spaces are trimmed (never an
 * error), so a stored name never starts or ends with a space.
 */
export function validateCaptainName(input: string): CaptainNameResult {
  const name = input.trim().normalize('NFC');
  // Counted in user-perceived characters, so a name in any script gets the same limits.
  const length = [...graphemes.segment(name)].length;
  if (length < CAPTAIN_NAME_MIN) return fail('tooShort');
  if (length > CAPTAIN_NAME_MAX) return fail('tooLong');
  if (!ALLOWED.test(name)) return fail('invalidCharacters');
  return { ok: true, name };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validates a stored profile (untrusted: storage may be edited or corrupted). */
export function parseCaptainProfile(stored: unknown): CaptainProfile | null {
  if (typeof stored !== 'object' || stored === null) return null;
  const { playerId, name } = stored as Partial<Record<string, unknown>>;
  if (typeof playerId !== 'string' || !UUID.test(playerId) || typeof name !== 'string') {
    return null;
  }
  const result = validateCaptainName(name);
  return result.ok && result.name === name ? { playerId, name } : null;
}
