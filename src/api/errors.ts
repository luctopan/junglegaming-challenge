import { isAxiosError, isCancel } from 'axios';

/**
 * Every failure of an API call, normalised: the UI and the retry policy
 * reason about these four kinds, never about Axios internals.
 * - `timeout`: no answer within the client timeout.
 * - `network`: the request never reached a server (offline, refused).
 * - `http`: the server answered with a non-2xx status.
 * - `invalid`: a 2xx answer whose body does not match the contract.
 */
export type ApiErrorKind = 'timeout' | 'network' | 'http' | 'invalid';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;

  constructor(kind: ApiErrorKind, message: string, status: number | null = null) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

/** A request the client aborted itself (superseded query, unmount): not a failure. */
export class ApiCancelled extends Error {
  constructor() {
    super('Request cancelled');
    this.name = 'ApiCancelled';
  }
}

const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR = 500;

export function normalizeApiError(error: unknown): ApiError | ApiCancelled {
  if (error instanceof ApiError || error instanceof ApiCancelled) return error;
  if (isCancel(error)) return new ApiCancelled();
  if (isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError('timeout', 'The server took too long to answer');
    }
    const status = error.response?.status;
    if (status !== undefined) return new ApiError('http', `HTTP ${status}`, status);
    return new ApiError('network', 'The server could not be reached');
  }
  return new ApiError('network', error instanceof Error ? error.message : String(error));
}

/**
 * Worth trying again: the request may succeed later. Client errors (4xx other
 * than 429) and contract violations fail the same way every time.
 */
export function isRetryable(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  switch (error.kind) {
    case 'timeout':
    case 'network':
      return true;
    case 'http':
      return (
        error.status !== null &&
        (error.status >= HTTP_SERVER_ERROR || error.status === HTTP_TOO_MANY_REQUESTS)
      );
    case 'invalid':
      return false;
  }
}
