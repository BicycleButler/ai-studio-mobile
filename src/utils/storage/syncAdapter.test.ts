import { describe, it, expect, vi } from 'vitest';
import { NetworkStorageSyncAdapter } from './syncAdapter';

describe('NetworkStorageSyncAdapter', () => {
    it('should sync to online if connected and successful', async () => {
        const mockApiClient = {
            addInterceptor: vi.fn(),
            clearInterceptors: vi.fn(),
            fetch: vi.fn().mockResolvedValue({}),
            fetchStream: vi.fn()
        };
        const mockOfflineService = {
            queueObservable: {} as any,
            registerSyncHandler: vi.fn(),
            enqueueOfflineMutation: vi.fn().mockResolvedValue(undefined),
            removeOfflineMutation: vi.fn(),
            getOfflineQueueLength: vi.fn(),
            clearOfflineMutations: vi.fn(),
            processOfflineMutations: vi.fn(),
            getOfflineQueue: vi.fn()
        };

        const adapter = new NetworkStorageSyncAdapter(mockApiClient, mockOfflineService);

        // Mock navigator.onLine to true
        Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

        adapter.syncItem({ id: 1 }, '/api/test', 'test_mutation');

        expect(mockApiClient.fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ id: 1 })
        }));

        // Let promises resolve
        await new Promise(r => setTimeout(r, 0));

        expect(mockOfflineService.enqueueOfflineMutation).not.toHaveBeenCalled();
    });

    it('should fallback to offline queue if offline', async () => {
        const mockApiClient = {
            addInterceptor: vi.fn(),
            clearInterceptors: vi.fn(),
            fetch: vi.fn(),
            fetchStream: vi.fn()
        };
        const mockOfflineService = {
            queueObservable: {} as any,
            registerSyncHandler: vi.fn(),
            enqueueOfflineMutation: vi.fn().mockResolvedValue(undefined),
            removeOfflineMutation: vi.fn(),
            getOfflineQueueLength: vi.fn(),
            clearOfflineMutations: vi.fn(),
            processOfflineMutations: vi.fn(),
            getOfflineQueue: vi.fn()
        };

        const adapter = new NetworkStorageSyncAdapter(mockApiClient, mockOfflineService);

        // Mock navigator.onLine to false
        Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

        adapter.syncItem({ id: 1 }, '/api/test', 'test_mutation');

        expect(mockApiClient.fetch).not.toHaveBeenCalled();
        expect(mockOfflineService.enqueueOfflineMutation).toHaveBeenCalledWith('test_mutation', { id: 1 });
    });

    it('should fallback to offline queue if online fetch fails', async () => {
        const mockApiClient = {
            addInterceptor: vi.fn(),
            clearInterceptors: vi.fn(),
            fetch: vi.fn().mockRejectedValue(new Error('Network failure')),
            fetchStream: vi.fn()
        };
        const mockOfflineService = {
            queueObservable: {} as any,
            registerSyncHandler: vi.fn(),
            enqueueOfflineMutation: vi.fn().mockResolvedValue(undefined),
            removeOfflineMutation: vi.fn(),
            getOfflineQueueLength: vi.fn(),
            clearOfflineMutations: vi.fn(),
            processOfflineMutations: vi.fn(),
            getOfflineQueue: vi.fn()
        };

        const adapter = new NetworkStorageSyncAdapter(mockApiClient, mockOfflineService);

        // Mock navigator.onLine to true
        Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

        adapter.syncItem({ id: 1 }, '/api/test', 'test_mutation');

        expect(mockApiClient.fetch).toHaveBeenCalled();

        // Let promises resolve
        await new Promise(r => setTimeout(r, 0));

        expect(mockOfflineService.enqueueOfflineMutation).toHaveBeenCalledWith('test_mutation', { id: 1 });
    });
});
