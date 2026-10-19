import { describe, it, expect, beforeEach } from 'vitest';
import { OfflineService, AsyncStorage } from './offlineService';

class MockAsyncStorage implements AsyncStorage {
  private store = new Map<string, any>();

  async getItem<T>(key: string): Promise<T | undefined> {
    return this.store.get(key) as T;
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }
}

describe('OfflineService', () => {
  let mockStorage: MockAsyncStorage;
  let service: OfflineService;

  beforeEach(() => {
    mockStorage = new MockAsyncStorage();
    service = new OfflineService('test_queue', mockStorage);
  });

  it('should enqueue mutations correctly', async () => {
    await service.enqueueOfflineMutation('TEST_ACTION', { id: 1 });
    const queueLength = await service.getOfflineQueueLength();
    expect(queueLength).toBe(1);

    const queue = await service.getOfflineQueue();
    expect(queue[0].type).toBe('TEST_ACTION');
    expect(queue[0].payload).toEqual({ id: 1 });
  });

  it('should remove mutations correctly', async () => {
    await service.enqueueOfflineMutation('TEST_ACTION', { id: 1 });
    const queue = await service.getOfflineQueue();
    const mutationId = queue[0].id;

    await service.removeOfflineMutation(mutationId);
    const newQueueLength = await service.getOfflineQueueLength();
    expect(newQueueLength).toBe(0);
  });
});

import { FallbackAsyncStorage } from './offlineService';

class FailingAsyncStorage implements AsyncStorage {
  private _failNext = 0;
  constructor(private fails: number) {
      this._failNext = fails;
  }
  async getItem<T>(_key: string): Promise<T | undefined> {
    return undefined;
  }

  async setItem<T>(_key: string, _value: T): Promise<void> {
    if (this._failNext > 0) {
        this._failNext--;
        throw new Error('Storage failed');
    }
  }
}

describe('FallbackAsyncStorage', () => {
    it('should retry all adapters', async () => {
        const failStorage = new FailingAsyncStorage(1);
        const memStorage = new MockAsyncStorage();
        const fallback = new FallbackAsyncStorage([failStorage, memStorage]);

        await fallback.setItem('k', 'v');
        const v = await memStorage.getItem('k');
        expect(v).toBe('v');

        // Second time, failStorage should succeed and be used
        await fallback.setItem('k', 'v2');
        const v2 = await memStorage.getItem('k');
        expect(v2).toBe('v'); // unchanged because it went to failStorage
    });
});
