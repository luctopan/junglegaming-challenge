import { describe, expect, it, vi } from 'vitest';
import { memoryStorage } from '../platform/storage';
import type { ApiClient } from './client';
import type { MatchSubmission } from './contracts';
import { ApiError } from './errors';
import { createPendingQueue } from './pendingQueue';
import { createQueryClient } from './queryClient';
import { queryKeys } from './queryKeys';
import { createSubmissionService } from './submissions';

const match = (matchId: string): MatchSubmission => ({
  matchId,
  playerId: '0b5e7a52-3c1d-4f7e-9a2b-6c8d0e1f2a3b',
  playerName: 'Test',
  playedAt: '2026-09-08T19:36:00.000Z',
  score: 24,
  durationMs: 120_000,
  endReason: 'time_up',
  config: { sessionSeconds: 120, spawnIntervalSeconds: 3 },
});

function setup(submitMatch: ApiClient['submitMatch']) {
  const storage = memoryStorage();
  const queue = createPendingQueue(() => storage);
  const queryClient = createQueryClient();
  const client = { submitMatch } as unknown as ApiClient;
  const service = createSubmissionService({ client, queryClient, queue });
  return { queue, queryClient, service };
}

describe('submission service', () => {
  it('queues before sending, then confirms and invalidates both lists', async () => {
    let queuedDuringRequest = false;
    const { queue, queryClient, service } = setup((m) => {
      queuedDuringRequest = queue.has(m.matchId);
      return Promise.resolve('created');
    });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    service.submit(match('a'));
    expect(service.status('a')).toBe('saving');
    await service.flush();
    await vi.waitFor(() => {
      expect(service.status('a')).toBe('saved');
    });
    expect(queuedDuringRequest).toBe(true);
    expect(queue.list()).toEqual([]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.ranking.all });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.history.all });
  });

  it('never sends the same match twice in parallel', async () => {
    const send = vi.fn(() => Promise.resolve('created' as const));
    const { service } = setup(send);
    service.submit(match('a'));
    service.retry('a');
    await service.flush();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('keeps a match pending after retryable failures, failed after a rejection', async () => {
    vi.useFakeTimers();
    try {
      const { queue, service } = setup((m) =>
        Promise.reject(
          m.matchId === 'down' ? new ApiError('http', '', 503) : new ApiError('http', '', 400),
        ),
      );
      service.submit(match('down'));
      service.submit(match('bad'));
      await vi.runAllTimersAsync();
      expect(service.status('down')).toBe('pending');
      expect(service.status('bad')).toBe('failed');
      expect(queue.list().map((m) => m.matchId)).toEqual(['down', 'bad']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('flushes what an earlier visit left in the queue', async () => {
    const send = vi.fn(() => Promise.resolve('existing' as const));
    const { queue, service } = setup(send);
    queue.add(match('left-over'));
    expect(service.status('left-over')).toBe('pending');
    await service.flush();
    await vi.waitFor(() => {
      expect(service.status('left-over')).toBe('saved');
    });
    expect(send).toHaveBeenCalledWith(match('left-over'));
  });
});
