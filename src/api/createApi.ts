import { browserStorage } from '../platform/storage';
import type { Api } from './apiContext';
import { createApiClient } from './client';
import { createPendingQueue } from './pendingQueue';
import { createQueryClient } from './queryClient';
import { createSubmissionService } from './submissions';

/** The app's API stack: one client, one query cache, one persisted pending queue. */
export function createApi(timeoutMs: number): Api {
  const client = createApiClient(timeoutMs);
  const queryClient = createQueryClient();
  const queue = createPendingQueue(browserStorage);
  const submissions = createSubmissionService({ client, queryClient, queue });
  return { client, queryClient, queue, submissions };
}
