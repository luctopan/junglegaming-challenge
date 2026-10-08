import type { MatchConfigRef } from '../../api/contracts';

export interface PlayedAt {
  /** `08 SEP` */
  readonly date: string;
  /** `21:42` (24 h) */
  readonly time: string;
  /** `September 8, 21:42`, for screen readers. */
  readonly spoken: string;
}

/** Date and time of a match in the player's time zone (`timeZone` for tests). */
export function formatPlayedAt(iso: string, timeZone?: string): PlayedAt {
  const date = new Date(iso);
  const options = timeZone === undefined ? {} : { timeZone };
  const parts = new Intl.DateTimeFormat('en-US', {
    ...options,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  const spoken = new Intl.DateTimeFormat('en-US', {
    ...options,
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return {
    date: `${part('day')} ${part('month').toUpperCase()}`,
    time: `${part('hour')}:${part('minute')}`,
    spoken,
  };
}

/** `120 second battles · 3 second spawn interval` (the ranking subtitle). */
export const describeConfig = (config: MatchConfigRef): string =>
  `${config.sessionSeconds} second battles · ${config.spawnIntervalSeconds} second spawn interval`;

/** Two-digit rank, as in the mockup (`01`, `12`, `103`). */
export const rankLabel = (rank: number): string => String(rank).padStart(2, '0');
