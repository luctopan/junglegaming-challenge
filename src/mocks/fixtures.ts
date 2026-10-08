import type { MatchConfigRef, MatchRecord } from '../api/contracts';
import { configKeyOf } from '../api/contracts';

/**
 * Other captains of the mock backend. Dates come from a fixed epoch (never
 * `Date.now()`), so rankings and screenshots are stable; player ids are
 * `fixture-…`, never a UUID, so a fixture can never be the real player.
 */
const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const MS_PER_SECOND = 1000;
const FIXTURE_EPOCH = Date.UTC(2026, 8, 8, 21, 42);

const CAPTAINS = [
  'Captain Flint',
  'Red Sparrow',
  'Storm Rider',
  'Sea Wolf',
  'Grey Gull',
  'Salty Meg',
  'Iron Hook',
  'Black Bess',
  'Tide Runner',
  'Old Barnacle',
  'Coral Queen',
  'Long John',
  'Mad Morgan',
];

interface FixtureSet {
  readonly config: MatchConfigRef;
  readonly scores: readonly number[];
}

const FIXTURE_SETS: readonly FixtureSet[] = [
  {
    config: { sessionSeconds: 120, spawnIntervalSeconds: 3 },
    scores: [38, 32, 21, 19, 17, 15, 15, 12, 11, 9, 7, 5, 3],
  },
  { config: { sessionSeconds: 60, spawnIntervalSeconds: 1 }, scores: [22, 18, 14, 9] },
  { config: { sessionSeconds: 180, spawnIntervalSeconds: 5 }, scores: [41, 33, 30, 26, 20, 8] },
];

function fixtureRecord(
  config: MatchConfigRef,
  score: number,
  set: number,
  index: number,
  prefix: string,
): MatchRecord {
  const playedAt = new Date(FIXTURE_EPOCH - (set * DAY_MS + index * 26 * MINUTE_MS)).toISOString();
  return {
    matchId: `${prefix}-match-${set}-${index}`,
    playerId: `fixture-captain-${index % CAPTAINS.length}`,
    playerName: CAPTAINS[index % CAPTAINS.length] ?? 'Captain',
    playedAt,
    score,
    durationMs: config.sessionSeconds * MS_PER_SECOND - (index % 3) * 9_000,
    endReason: index % 3 === 0 ? 'time_up' : 'defeated',
    config,
    configKey: configKeyOf(config),
    recordedAt: playedAt,
  };
}

/** The `success` data set: 23 matches over three configs (120s-3s fills three pages). */
export const FIXTURE_RECORDS: readonly MatchRecord[] = FIXTURE_SETS.flatMap(
  ({ config, scores }, set) =>
    scores.map((score, index) => fixtureRecord(config, score, set, index, 'fixture')),
);

const BULK_PER_CONFIG = 60;
const BULK_TOP_SCORE = 90;

/** `multi-page`: 60 more matches per config, for long pagination. */
export const BULK_RECORDS: readonly MatchRecord[] = FIXTURE_SETS.flatMap(({ config }, set) =>
  Array.from({ length: BULK_PER_CONFIG }, (_, index) =>
    fixtureRecord(config, Math.max(0, BULK_TOP_SCORE - index), set, index + 100, 'bulk'),
  ),
);
