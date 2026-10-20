import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NetworkStorageSyncAdapter } from './syncAdapter';
import { IApiClient } from '../apiClient';
import { IOfflineService } from '../offlineService';
import { INetworkStatusProvider, NetworkStatus } from '../networkStatus';
import { Observable } from '../observable';

describe('NetworkStorageSyncAdapter', () => {
    let mockApiClient: any;
    let mockOfflineService: any;

    beforeEach(() => {
        mockApiClient = {
            fetch: vi.fn(),
        } as unknown as IApiClient;

        mockOfflineService = {
            enqueueOfflineMutation: vi.fn(),
        } as unknown as IOfflineService;
    });

    it('should call apiClient.fetch when online', async () => {
        const mockNetworkStatusProvider: INetworkStatusProvider = {
            isOnline: vi.fn().mockReturnValue(true),
            getObservable: vi.fn().mockReturnValue(new Observable<NetworkStatus>({ isOnline: true, wasOffline: false }))
        };

        const adapter = new NetworkStorageSyncAdapter(mockApiClient, mockOfflineService, mockNetworkStatusProvider);
        const item = { id: 1, name: 'test' };

        mockApiClient.fetch.mockResolvedValueOnce({ ok: true });

        adapter.syncItem(item, '/api/test', 'test_mutation');

        expect(mockNetworkStatusProvider.isOnline).toHaveBeenCalled();
        expect(mockApiClient.fetch).toHaveBeenCalledWith('/api/test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(item),
        });
        expect(mockOfflineService.enqueueOfflineMutation).not.toHaveBeenCalled();
    });

    it('should enqueue offline mutation when offline', async () => {
        const mockNetworkStatusProvider: INetworkStatusProvider = {
            isOnline: vi.fn().mockReturnValue(false),
            getObservable: vi.fn().mockReturnValue(new Observable<NetworkStatus>({ isOnline: false, wasOffline: true }))
        };

        const adapter = new NetworkStorageSyncAdapter(mockApiClient, mockOfflineService, mockNetworkStatusProvider);
        const item = { id: 1, name: 'test' };

        mockOfflineService.enqueueOfflineMutation.mockResolvedValueOnce(undefined);

        adapter.syncItem(item, '/api/test', 'test_mutation');

        expect(mockNetworkStatusProvider.isOnline).toHaveBeenCalled();
        expect(mockApiClient.fetch).not.toHaveBeenCalled();
        expect(mockOfflineService.enqueueOfflineMutation).toHaveBeenCalledWith('test_mutation', item);
    });

    it('should fallback to offline queue if online fetch fails', async () => {
        const mockNetworkStatusProvider: INetworkStatusProvider = {
            isOnline: vi.fn().mockReturnValue(true),
            getObservable: vi.fn().mockReturnValue(new Observable<NetworkStatus>({ isOnline: true, wasOffline: false }))
        };

        const adapter = new NetworkStorageSyncAdapter(mockApiClient, mockOfflineService, mockNetworkStatusProvider);
        const item = { id: 1, name: 'test' };

        mockApiClient.fetch.mockRejectedValueOnce(new Error('Network failure'));
        mockOfflineService.enqueueOfflineMutation.mockResolvedValueOnce(undefined);

        adapter.syncItem(item, '/api/test', 'test_mutation');

        expect(mockNetworkStatusProvider.isOnline).toHaveBeenCalled();
        expect(mockApiClient.fetch).toHaveBeenCalled();

        // Wait for the catch block to execute
        await new Promise(process.nextTick);

        expect(mockOfflineService.enqueueOfflineMutation).toHaveBeenCalledWith('test_mutation', item);
    });
});
