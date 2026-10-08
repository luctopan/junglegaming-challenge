import type { EndReason } from '../../../api/contracts';

/** How an end reason reads on the Result screen and in the match history. */
export const END_REASON_LABEL: Readonly<Record<EndReason, string>> = {
  time_up: 'Time up',
  defeated: 'Defeated',
};
