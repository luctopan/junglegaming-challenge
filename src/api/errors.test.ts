import { AxiosError, AxiosHeaders, CanceledError } from 'axios';
import { describe, expect, it } from 'vitest';
import { apiTimeoutMs, DEFAULT_API_TIMEOUT_MS } from './client';
import { ApiCancelled, ApiError, isRetryable, normalizeApiError } from './errors';
import { retryDelayMs, shouldRetry } from './queryClient';

const httpError = (status: number) =>
  new AxiosError('fail', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    statusText: '',
    data: null,
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

describe('API error normaliser', () => {
  it('maps Axios failures to the four kinds', () => {
    expect(normalizeApiError(new AxiosError('t', 'ECONNABORTED'))).toMatchObject({
      kind: 'timeout',
    });
    expect(normalizeApiError(new AxiosError('n', 'ERR_NETWORK'))).toMatchObject({
      kind: 'network',
    });
    expect(normalizeApiError(httpError(503))).toMatchObject({ kind: 'http', status: 503 });
    expect(normalizeApiError(new CanceledError())).toBeInstanceOf(ApiCancelled);
    expect(normalizeApiError(new TypeError('boom'))).toMatchObject({ kind: 'network' });
  });

  it('retries only what may pass later', () => {
    const retryable = [
      new ApiError('timeout', ''),
      new ApiError('network', ''),
      new ApiError('http', '', 500),
      new ApiError('http', '', 503),
      new ApiError('http', '', 429),
    ];
    const final = [
      new ApiError('http', '', 400),
      new ApiError('http', '', 409),
      new ApiError('http', '', 422),
      new ApiError('invalid', ''),
      new ApiCancelled(),
      new Error('x'),
    ];
    for (const error of retryable) expect(isRetryable(error), error.message).toBe(true);
    for (const error of final) expect(isRetryable(error)).toBe(false);
    expect(shouldRetry(0, retryable[0])).toBe(true);
    expect(shouldRetry(2, retryable[0])).toBe(false);
    expect([0, 1, 2, 5].map(retryDelayMs)).toEqual([500, 1000, 2000, 4000]);
  });

  it('reads the timeout override only in test mode', () => {
    expect(apiTimeoutMs('?apiTimeout=300', true)).toBe(300);
    expect(apiTimeoutMs('?apiTimeout=300', false)).toBe(DEFAULT_API_TIMEOUT_MS);
    expect(apiTimeoutMs('', false, '5000')).toBe(5000);
    expect(apiTimeoutMs('?apiTimeout=abc', true, '')).toBe(DEFAULT_API_TIMEOUT_MS);
  });
});
