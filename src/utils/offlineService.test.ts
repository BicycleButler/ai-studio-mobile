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
