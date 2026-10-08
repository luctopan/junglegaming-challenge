import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Api } from './apiContext';
import { ApiContext } from './apiContext';

/** Provides the API client, the query cache and the submission service (built in main.tsx). */
export function ApiProvider({
  api,
  children,
}: {
  readonly api: Api;
  readonly children: ReactNode;
}) {
  return (
    <ApiContext value={api}>
      <QueryClientProvider client={api.queryClient}>{children}</QueryClientProvider>
    </ApiContext>
  );
}
