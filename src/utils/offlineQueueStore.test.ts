import { describe, it, expect, beforeEach } from 'vitest';
import { OfflineQueueStore } from './offlineQueueStore';
import { AsyncStorage } from './asyncStorage';
import { NoOpLogger } from './logger';

class MockAsyncStorage implements AsyncStorage {
  private store = new Map<string, any>();

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
        store.queueObservable.subscribe(() => notified = true);
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
