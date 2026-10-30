import { describe, it, expect, vi } from 'vitest';
import {
  startPolling,
  FixedIntervalPollingStrategy,
  ExponentialBackoffPollingStrategy,
} from './polling';

describe('polling strategies', () => {
  it('FixedIntervalPollingStrategy returns fixed intervals', () => {
    const strategy = new FixedIntervalPollingStrategy(1000);
    expect(strategy.getNextDelayMs(1)).toBe(1000);
    expect(strategy.getNextDelayMs(2, new Error())).toBe(1000);
  });

  it('ExponentialBackoffPollingStrategy scales delay with error', () => {
    const strategy = new ExponentialBackoffPollingStrategy(1000, 10000, 2);
    expect(strategy.getNextDelayMs(1)).toBe(1000);

    // First attempt with error
    const delay1 = strategy.getNextDelayMs(1, new Error());
    expect(delay1).toBeGreaterThanOrEqual(1000);
    expect(delay1).toBeLessThanOrEqual(1500);

    // Second attempt with error
    const delay2 = strategy.getNextDelayMs(2, new Error());
    expect(delay2).toBeGreaterThanOrEqual(2000);
    expect(delay2).toBeLessThanOrEqual(2500);

    // Hit max
    const delay10 = strategy.getNextDelayMs(10, new Error());
    expect(delay10).toBeGreaterThanOrEqual(10000);
    expect(delay10).toBeLessThanOrEqual(10500);
  });
});

describe('startPolling', () => {
  it('should run immediately and poll repeatedly', async () => {
    let count = 0;
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(++count));
    const onUpdate = vi.fn();

    const { stop } = startPolling(fetcher, {
      strategy: new FixedIntervalPollingStrategy(10),
      onUpdate,
    });

    await new Promise(r => setTimeout(r, 25));
    stop();

    expect(fetcher.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(onUpdate.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
