import { describe, it, expect, vi } from 'vitest';
import { ExponentialBackoffRetryStrategy } from './apiClientRetry';
import { BaseApiError } from './apiClientErrors';
import { FixedIntervalDelayStrategy } from './delayStrategy';

describe('ExponentialBackoffRetryStrategy', () => {
  it('should return on first successful fetch', async () => {
    const strategy = new ExponentialBackoffRetryStrategy(new FixedIntervalDelayStrategy(0));
    const mockFetcher = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response);

    const response = await strategy.execute('test-url', {}, {
      retries: 3,
      fetcher: mockFetcher,
      retryableStatusCodes: new Set([500]),
    });

    expect(response.ok).toBe(true);
    expect(mockFetcher).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable status code and eventually succeed', async () => {
    const strategy = new ExponentialBackoffRetryStrategy(new FixedIntervalDelayStrategy(0));
    const mockFetcher = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response);

    const response = await strategy.execute('test-url', {}, {
      retries: 3,
      fetcher: mockFetcher,
      retryableStatusCodes: new Set([500]),
    });

    expect(response.ok).toBe(true);
    expect(mockFetcher).toHaveBeenCalledTimes(3);
  });

  it('should not retry on non-retryable status code', async () => {
    const strategy = new ExponentialBackoffRetryStrategy(new FixedIntervalDelayStrategy(0));
    const mockFetcher = vi.fn().mockResolvedValue({ ok: false, status: 400 } as Response);

    const response = await strategy.execute('test-url', {}, {
      retries: 3,
      fetcher: mockFetcher,
      retryableStatusCodes: new Set([500]),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(400);
    expect(mockFetcher).toHaveBeenCalledTimes(1);
  });

  it('should return last response if max retries reached and it is a response', async () => {
    const strategy = new ExponentialBackoffRetryStrategy(new FixedIntervalDelayStrategy(0));
    const mockFetcher = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);

    const response = await strategy.execute('test-url', {}, {
      retries: 2,
      fetcher: mockFetcher,
      retryableStatusCodes: new Set([500]),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(500);
    expect(mockFetcher).toHaveBeenCalledTimes(2);
  });

  it('should throw error if max retries reached and last attempt was an error', async () => {
    const strategy = new ExponentialBackoffRetryStrategy(new FixedIntervalDelayStrategy(0));
    const mockFetcher = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(strategy.execute('test-url', {}, {
      retries: 2,
      fetcher: mockFetcher,
      retryableStatusCodes: new Set([500]),
    })).rejects.toThrow(BaseApiError);

    expect(mockFetcher).toHaveBeenCalledTimes(2);
  });

  it('should abort immediately on AbortError', async () => {
      const strategy = new ExponentialBackoffRetryStrategy(new FixedIntervalDelayStrategy(0));
      const abortError = new Error('The user aborted a request.');
      abortError.name = 'AbortError';
      const mockFetcher = vi.fn().mockRejectedValue(abortError);

      await expect(strategy.execute('test-url', {}, {
          retries: 3,
          fetcher: mockFetcher,
          retryableStatusCodes: new Set([500]),
      })).rejects.toThrow(abortError);

      expect(mockFetcher).toHaveBeenCalledTimes(1); // Should only call once
  });
});
