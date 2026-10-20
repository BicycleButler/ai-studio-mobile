import { describe, it, expect } from 'vitest';
import { FixedIntervalDelayStrategy, ExponentialBackoffDelayStrategy } from './delayStrategy';

describe('FixedIntervalDelayStrategy', () => {
    it('should always return the fixed interval', () => {
        const strategy = new FixedIntervalDelayStrategy(1000);
        expect(strategy.getNextDelayMs(1)).toBe(1000);
        expect(strategy.getNextDelayMs(2, new Error())).toBe(1000);
        expect(strategy.getNextDelayMs(5)).toBe(1000);
    });
});

describe('ExponentialBackoffDelayStrategy', () => {
    it('should return base delay when there is no error', () => {
        const strategy = new ExponentialBackoffDelayStrategy(1000, 10000, 2, 0);
        expect(strategy.getNextDelayMs(1)).toBe(1000);
        expect(strategy.getNextDelayMs(2)).toBe(1000);
    });

    it('should apply exponential backoff when there is an error', () => {
        const strategy = new ExponentialBackoffDelayStrategy(1000, 10000, 2, 0); // 0 jitter for deterministic testing

        // attempt 1 usually means first failure occurred
        expect(strategy.getNextDelayMs(1, new Error())).toBe(1000); // 1000 * 2^0
        expect(strategy.getNextDelayMs(2, new Error())).toBe(2000); // 1000 * 2^1
        expect(strategy.getNextDelayMs(3, new Error())).toBe(4000); // 1000 * 2^2
        expect(strategy.getNextDelayMs(4, new Error())).toBe(8000); // 1000 * 2^3
    });

    it('should cap the delay at maxDelayMs', () => {
        const strategy = new ExponentialBackoffDelayStrategy(1000, 5000, 2, 0);
        expect(strategy.getNextDelayMs(4, new Error())).toBe(5000); // 8000 capped to 5000
    });

    it('should add jitter within bounds', () => {
        const jitterMax = 500;
        const strategy = new ExponentialBackoffDelayStrategy(1000, 10000, 2, jitterMax);

        const delay = strategy.getNextDelayMs(2, new Error());
        // base = 2000, max jitter = 500
        expect(delay).toBeGreaterThanOrEqual(2000);
        expect(delay).toBeLessThan(2000 + jitterMax);
    });
});
