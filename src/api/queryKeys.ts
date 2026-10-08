import type { ConfigKey } from './contracts';

/**
 * Query keys, rooted so one invalidation covers every page of a list
 * (`ranking.all` after a submission refreshes every config and page).
 */
export const queryKeys = {
  ranking: {
    all: ['ranking'] as const,
    configs: () => ['ranking', 'configs'] as const,
    page: (configKey: ConfigKey, page: number) => ['ranking', 'page', configKey, page] as const,
  },
  history: {
    all: ['history'] as const,
    page: (playerId: string, page: number) => ['history', playerId, page] as const,
  },
} as const;

export const submitMutationKey = (matchId: string) => ['submitMatch', matchId] as const;
