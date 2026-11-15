import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncEngine } from './syncEngine';
import { IOfflineQueueStore } from './offlineQueueStore';
import { NoOpLogger } from './logger';
import { OfflineMutation } from './offlineService';

describe('SyncEngine', () => {
  let mockQueueStore: import('vitest').Mocked<IOfflineQueueStore>;
  let engine: SyncEngine;
  let queueData: OfflineMutation[];

  beforeEach(() => {
    queueData = [];
    mockQueueStore = {
      getObservable: vi.fn(),
      enqueue: vi.fn(),
      remove: vi.fn(),
      removeMany: vi.fn(async (ids: string[]) => {
        queueData = queueData.filter(m => !ids.includes(m.id));
      }),
      clear: vi.fn(),
      replace: vi.fn(),
      getQueue: vi.fn(async () => queueData),
      getSnapshot: vi.fn(),
      dispose: vi.fn()
    };

    engine = new SyncEngine(mockQueueStore, new NoOpLogger());
  });

  it('should process successful mutations and remove them from queue', async () => {
    queueData = [
      { id: '1', type: 'TEST_ACTION', payload: {}, timestamp: 1 }
    ];

    let callCount = 0;
    engine.registerSyncHandler('TEST_ACTION', async () => {
      callCount++;
      return { success: true };
    });

    const result = await engine.processOfflineMutations();

    expect(result.success).toBe(true);
    expect(callCount).toBe(1);
    expect(mockQueueStore.removeMany).toHaveBeenCalledWith(['1']);
  });

  it('should halt processing on first retryable failure (Strict FIFO)', async () => {
    queueData = [
      { id: '1', type: 'SUCCESS_ACTION', payload: {}, timestamp: 1 },
      { id: '2', type: 'FAILING_ACTION', payload: {}, timestamp: 2 },
      { id: '3', type: 'SUCCESS_ACTION', payload: {}, timestamp: 3 }
    ];

    let callCount = 0;
    engine.registerSyncHandler('FAILING_ACTION', async () => {
      callCount++;
      return { success: false, retryable: true };
    });
    engine.registerSyncHandler('SUCCESS_ACTION', async () => {
      callCount++;
      return { success: true };
    });

    const result = await engine.processOfflineMutations();

    expect(result.success).toBe(false);
    expect(callCount).toBe(2); // Must stop after first failure
    expect(mockQueueStore.removeMany).toHaveBeenCalledWith(['1']); // Only 1 must be removed
  });

  it('should drop non-retryable failures and continue', async () => {
    queueData = [
      { id: '1', type: 'FAIL_NON_RETRY', payload: {}, timestamp: 1 },
      { id: '2', type: 'SUCCESS_ACTION', payload: {}, timestamp: 2 }
    ];

    engine.registerSyncHandler('FAIL_NON_RETRY', async () => {
      return { success: false, retryable: false };
    });
    engine.registerSyncHandler('SUCCESS_ACTION', async () => {
      return { success: true };
    });

    const result = await engine.processOfflineMutations();

    expect(result.success).toBe(true); // Process finishes
    expect(mockQueueStore.removeMany).toHaveBeenCalledWith(['1', '2']); // The two must be removed (one dropped, one succeeded)
  });

  it('should drop poison-pill mutation after reaching max retries so subsequent items unblock', async () => {
    queueData = [
      { id: '1', type: 'FAILING_ACTION', payload: {}, timestamp: 1, attempts: 4 },
      { id: '2', type: 'SUCCESS_ACTION', payload: {}, timestamp: 2 }
    ];

    engine.registerSyncHandler('FAILING_ACTION', async () => ({ success: false, retryable: true }));
    engine.registerSyncHandler('SUCCESS_ACTION', async () => ({ success: true }));

    const result = await engine.processOfflineMutations();

    expect(result.success).toBe(true);
    expect(mockQueueStore.removeMany).toHaveBeenCalledWith(['1', '2']);
  });

  it('should skip processing when head mutation is within nextRetryAt backoff window', async () => {
    queueData = [
      { id: '1', type: 'SUCCESS_ACTION', payload: {}, timestamp: 1, attempts: 1, nextRetryAt: Date.now() + 60_000 }
    ];

    const handler = vi.fn(async () => ({ success: true }));
    engine.registerSyncHandler('SUCCESS_ACTION', handler);

    const result = await engine.processOfflineMutations();

    expect(result.success).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });
});
