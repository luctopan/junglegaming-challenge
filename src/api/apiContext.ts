import type { QueryClient } from '@tanstack/react-query';
import { createContext, useContext } from 'react';
import type { ApiClient } from './client';
import type { PendingQueue } from './pendingQueue';
import type { SubmissionService } from './submissions';

export interface Api {
  readonly client: ApiClient;
  readonly queryClient: QueryClient;
  readonly queue: PendingQueue;
  readonly submissions: SubmissionService;
}

export const ApiContext = createContext<Api | null>(null);

export function useApi(): Api {
  const api = useContext(ApiContext);
  if (api === null) throw new Error('useApi must be used inside <ApiProvider>');
  return api;
}
