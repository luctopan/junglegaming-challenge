import { useEffect } from 'react';
import { countCommit } from '../../platform/commitCounters';

/** Counts every commit of the calling component (read by the e2e suite in test mode). */
export function useCommitCounter(name: string): void {
  useEffect(() => {
    countCommit(name);
  });
}
