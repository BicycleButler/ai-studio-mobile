import { describe, it, expect, beforeEach } from 'vitest';
import { OfflineQueueStore, IAsyncStorageAdapter } from './offlineQueueStore';
import { NoOpLogger } from './logger';

class MockAsyncStorage implements IAsyncStorageAdapter {
  private store = new Map<string, unknown>();

  async getItem<T>(key: string): Promise<T | undefined> {
    return this.store.get(key) as T;
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }
}

describe('OfflineQueueStore', () => {
    let mockStorage: MockAsyncStorage;
    let store: OfflineQueueStore;

    beforeEach(() => {
        mockStorage = new MockAsyncStorage();
        store = new OfflineQueueStore({
            storageKey: 'test_queue',
            storageAdapter: mockStorage,
            logger: new NoOpLogger()
        });
    });

    it('should notify queue change when items change', async () => {
        let notified = false;
        store.getObservable().subscribe(() => notified = true);
        const item = { type: 't1', payload: 'p1', timestamp: 1, id: 'id1' };
        await store.enqueue(item);
        // microtask queued for notification
        await new Promise(r => setTimeout(r, 0));
        expect(notified).toBe(true);
    });

    it('should enqueue item', async () => {
        const item = { type: 't1', payload: 'p1', timestamp: 1, id: 'id1' };
        await store.enqueue(item);
        const q = await store.getQueue();
        expect(q.length).toBe(1);
        expect(q[0]).toEqual(item);
    });

    it('should remove item', async () => {
        const item1 = { type: 't1', payload: 'p1', timestamp: 1, id: 'id1' };
        const item2 = { type: 't2', payload: 'p2', timestamp: 2, id: 'id2' };
        await store.enqueue(item1);
        await store.enqueue(item2);

        await store.remove('id1');

        const q = await store.getQueue();
        expect(q.length).toBe(1);
        expect(q[0].id).toBe('id2');
    });

    it('should remove many items', async () => {
        const item1 = { type: 't1', payload: 'p1', timestamp: 1, id: 'id1' };
        const item2 = { type: 't2', payload: 'p2', timestamp: 2, id: 'id2' };
        const item3 = { type: 't3', payload: 'p3', timestamp: 3, id: 'id3' };

        await store.enqueue(item1);
        await store.enqueue(item2);
        await store.enqueue(item3);

        await store.removeMany(['id1', 'id3']);

        const q = await store.getQueue();
        expect(q.length).toBe(1);
        expect(q[0].id).toBe('id2');
    });

    it('should clear all items', async () => {
        const item1 = { type: 't1', payload: 'p1', timestamp: 1, id: 'id1' };
        await store.enqueue(item1);

        await store.clear();

        const q = await store.getQueue();
        expect(q.length).toBe(0);
    });

    it('should replace all items', async () => {
        const item1 = { type: 't1', payload: 'p1', timestamp: 1, id: 'id1' };
        const item2 = { type: 't2', payload: 'p2', timestamp: 2, id: 'id2' };
        await store.enqueue(item1);

        await store.replace([item2]);

        const q = await store.getQueue();
        expect(q.length).toBe(1);
        expect(q[0].id).toBe('id2');
    });
});

class FailingAsyncStorage implements IAsyncStorageAdapter {
  async getItem<T>(_key: string): Promise<T | undefined> {
    return [] as T;
  }
  async setItem<T>(_key: string, _value: T): Promise<void> {
    throw new Error('Storage write failed artificially');
  }
}

describe('OfflineQueueStore Error Propagation', () => {
    it('should throw an error and not modify cache if storage write fails', async () => {
        const store = new OfflineQueueStore({
            storageKey: 'test_queue_error',
            storageAdapter: new FailingAsyncStorage(),
            logger: new NoOpLogger()
        });

        await new Promise(r => setTimeout(r, 0)); // wait for initial load

        await expect(store.enqueue({ type: 't1', payload: 'p1', timestamp: 1, id: 'id1' }))
            .rejects.toThrow('Storage write failed artificially');

        const q = await store.getQueue();
        expect(q.length).toBe(0); // Should remain empty
    });
    it('should propagate errors correctly and unlock mutex for subsequent calls', async () => {
        const store = new OfflineQueueStore({
            storageKey: 'test_queue_error_2',
            storageAdapter: new FailingAsyncStorage(),
            logger: new NoOpLogger()
        });

        await new Promise(r => setTimeout(r, 0)); // wait for initial load

        await expect(store.enqueue({ type: 't1', payload: 'p1', timestamp: 1, id: 'id1' }))
            .rejects.toThrow('Storage write failed artificially');

        // Test that mutex is released by asserting that a second call rejects cleanly and doesn't timeout
        await expect(store.clear()).rejects.toThrow('Storage write failed artificially');
    });
});
