import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FallbackStorageWrapper } from './FallbackStorageWrapper';
import { NoOpLogger } from '../logger';

class MockStorage implements Storage {
    private store = new Map<string, string>();
    public length = 0;

    getItem(key: string): string | null {
        return this.store.get(key) || null;
    }

    setItem(key: string, value: string): void {
        if (key === 'throw_quota') {
            const err = new Error('QuotaExceededError');
            err.name = 'QuotaExceededError';
            throw err;
        }
        this.store.set(key, value);
        this.length = this.store.size;
    }

    removeItem(key: string): void {
        this.store.delete(key);
        this.length = this.store.size;
    }

    clear(): void {
        this.store.clear();
        this.length = 0;
    }

    key(index: number): string | null {
        return Array.from(this.store.keys())[index] || null;
    }
}

describe('FallbackStorageWrapper', () => {
    let mockStorage: MockStorage;
    let logger: NoOpLogger;

    beforeEach(() => {
        mockStorage = new MockStorage();
        logger = new NoOpLogger();
    });

    it('should write and read items successfully', () => {
        const wrapper = new FallbackStorageWrapper(mockStorage, logger);
        wrapper.setItem('test_key', 'test_value');
        expect(wrapper.getItem('test_key')).toBe('test_value');
    });

    it('should promote to memory on quota exceeded and recover space', () => {
        const wrapper = new FallbackStorageWrapper(mockStorage, logger);

        let quotaExceededFired = false;
        wrapper.quotaExceededEvent.subscribe(() => {
            quotaExceededFired = true;
        });

        wrapper.setItem('throw_quota', 'value');

        expect(quotaExceededFired).toBe(true);
        expect(wrapper.getItem('throw_quota')).toBe('value'); // From memory fallback
    });
});
