import { describe, it, expect, beforeEach } from 'vitest';
import { OfflineService } from './offlineService';
import { AsyncStorage } from './asyncStorage';

class MockAsyncStorage implements AsyncStorage {
  private store = new Map<string, unknown>();

  async getItem<T>(key: string): Promise<T | undefined> {
    return this.store.get(key) as T;
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }
}

import { NoOpLogger } from './logger';
import { DefaultCrossTabNotifierFactory } from './crossTabNotifier/CrossTabNotifierFactory';
import { defaultPlatformService } from '../services/platformService';

describe('OfflineService', () => {
  let mockStorage: MockAsyncStorage;
  let service: OfflineService;

  beforeEach(() => {
    mockStorage = new MockAsyncStorage();
    service = new OfflineService({
      storageKey: 'test_queue',
      storageAdapter: mockStorage,
      logger: new NoOpLogger(),
      crossTabNotifierFactory: new DefaultCrossTabNotifierFactory(),
      platformService: defaultPlatformService
    });
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

  it('should halt processing on first failure (Strict FIFO)', async () => {
    let callCount = 0;
    service.registerSyncHandler('FAILING_ACTION', async () => {
      callCount++;
      return { success: false };
    });
    service.registerSyncHandler('SUCCESS_ACTION', async () => {
      callCount++;
      return { success: true };
    });

    await service.enqueueOfflineMutation('SUCCESS_ACTION', { id: 1 });
    await service.enqueueOfflineMutation('FAILING_ACTION', { id: 2 });
    await service.enqueueOfflineMutation('SUCCESS_ACTION', { id: 3 });

    const result = await service.processOfflineMutations();

    expect(result.success).toBe(false);
    expect(callCount).toBe(2); // Should stop after first failure

    const queue = await service.getOfflineQueue();
    expect(queue.length).toBe(2);
    expect(queue[0].type).toBe('FAILING_ACTION');
    expect(queue[1].type).toBe('SUCCESS_ACTION');
  });
});

import { FallbackAsyncStorage } from './asyncStorage';

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
        const fallback = new FallbackAsyncStorage([failStorage, memStorage], new NoOpLogger());

        await fallback.setItem('k', 'v');
        const v = await memStorage.getItem('k');
        expect(v).toBe('v');

        // Second time, failStorage should succeed and be used
        await fallback.setItem('k', 'v2');
        const v2 = await memStorage.getItem('k');
        expect(v2).toBe('v'); // unchanged because it went to failStorage
    });

    it('should throw error when all adapters fail to set item', async () => {
        const failStorage1 = new FailingAsyncStorage(10);
        const failStorage2 = new FailingAsyncStorage(10);
        const fallback = new FallbackAsyncStorage([failStorage1, failStorage2], new NoOpLogger());

        await expect(fallback.setItem('k', 'v')).rejects.toThrow('Storage failed');
    });
});
