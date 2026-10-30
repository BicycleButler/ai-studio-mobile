import { describe, it, expect } from 'vitest';
import { MemoryAsyncStorage, FallbackAsyncStorage } from './asyncStorage';
import { NoOpLogger } from './logger';

describe('AsyncStorage Implementations', () => {
  it('MemoryAsyncStorage should get and set items', async () => {
    const storage = new MemoryAsyncStorage();
    await storage.setItem('key', 'value');
    expect(await storage.getItem('key')).toBe('value');
    expect(await storage.getItem('missing')).toBeUndefined();
  });

  it('FallbackAsyncStorage should handle get fallbacks correctly', async () => {
      const failingStorage = {
          getItem: async <T>() => Promise.reject(new Error('fail')) as Promise<T | undefined>,
          setItem: async () => Promise.reject(new Error('fail')) as Promise<void>
      };

      const passingStorage = {
          getItem: async <T>() => Promise.resolve('fallback-value' as T),
          setItem: async () => Promise.resolve()
      };

      const fallback = new FallbackAsyncStorage([failingStorage, passingStorage], new NoOpLogger());
      expect(await fallback.getItem('key')).toBe('fallback-value');
  });
});
