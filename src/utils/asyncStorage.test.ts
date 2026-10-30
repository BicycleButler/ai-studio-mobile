import { describe, it, expect } from 'vitest';
import { IndexedDbAsyncStorage, MemoryAsyncStorage, FallbackAsyncStorage } from './asyncStorage';
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
          getItem: async () => { throw new Error('fail'); },
          setItem: async () => { throw new Error('fail'); }
      };

      const passingStorage = {
          getItem: async () => 'fallback-value',
          setItem: async () => {}
      };

      const fallback = new FallbackAsyncStorage([failingStorage, passingStorage], new NoOpLogger());
      expect(await fallback.getItem('key')).toBe('fallback-value');
  });
});
