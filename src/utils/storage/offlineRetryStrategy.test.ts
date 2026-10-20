import { describe, it, expect } from 'vitest';
import { DefaultOfflineRetryStrategy } from './offlineRetryStrategy';
import { BaseApiError } from '../apiClientErrors';

describe('DefaultOfflineRetryStrategy', () => {
    const strategy = new DefaultOfflineRetryStrategy();

    it('should enqueue network errors (statusCode 0)', () => {
        const err = new BaseApiError('Network Error', 0);
        expect(strategy.shouldEnqueue(err)).toBe(true);
    });

    it('should enqueue 5xx server errors', () => {
        expect(strategy.shouldEnqueue(new BaseApiError('Internal Server Error', 500))).toBe(true);
        expect(strategy.shouldEnqueue(new BaseApiError('Bad Gateway', 502))).toBe(true);
    });

    it('should enqueue specific retryable 4xx errors', () => {
        expect(strategy.shouldEnqueue(new BaseApiError('Too Many Requests', 429))).toBe(true);
        expect(strategy.shouldEnqueue(new BaseApiError('Request Timeout', 408))).toBe(true);
    });

    it('should not enqueue client errors (400, 401, 403, 404)', () => {
        expect(strategy.shouldEnqueue(new BaseApiError('Bad Request', 400))).toBe(false);
        expect(strategy.shouldEnqueue(new BaseApiError('Unauthorized', 401))).toBe(false);
        expect(strategy.shouldEnqueue(new BaseApiError('Forbidden', 403))).toBe(false);
        expect(strategy.shouldEnqueue(new BaseApiError('Not Found', 404))).toBe(false);
    });

    it('should enqueue non-BaseApiError exceptions', () => {
        expect(strategy.shouldEnqueue(new Error('Unknown Error'))).toBe(true);
    });
});
