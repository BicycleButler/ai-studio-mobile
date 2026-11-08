import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NetworkStorageSyncAdapter, ApiClientSyncTransport } from './syncAdapter';
import { IApiClient } from '../apiClient';
import { IOfflineService } from '../offlineService';
import { INetworkStatusProvider, NetworkStatus } from '../networkStatus';
import { Observable } from '../observable';

import { NoOpLogger } from '../logger';
import { DefaultOfflineRetryStrategy } from './offlineRetryStrategy';

describe('NetworkStorageSyncAdapter', () => {
    let mockApiClient: import("vitest").Mocked<IApiClient>;
    let mockOfflineService: import("vitest").Mocked<IOfflineService>;
    let noOpLogger: NoOpLogger;
    let defaultRetryStrategy: DefaultOfflineRetryStrategy;

    beforeEach(() => {
        mockApiClient = {
            ...({} as unknown as import("vitest").Mocked<IApiClient>),
            fetch: vi.fn(),
        } as unknown as import("vitest").Mocked<IApiClient>;

        mockOfflineService = {
            ...({} as unknown as import("vitest").Mocked<IOfflineService>),
            enqueueOfflineMutation: vi.fn(),
        } as unknown as import("vitest").Mocked<IOfflineService>;

        noOpLogger = new NoOpLogger();
        defaultRetryStrategy = new DefaultOfflineRetryStrategy();
    });

    it('should call apiClient.fetch when online', async () => {
        const mockNetworkStatusProvider: INetworkStatusProvider = {
            isOnline: vi.fn().mockReturnValue(true),
            getObservable: vi.fn().mockReturnValue(new Observable<NetworkStatus>({ isOnline: true, wasOffline: false }))
        };

        const transport = new ApiClientSyncTransport(mockApiClient);
        const adapter = new NetworkStorageSyncAdapter({ transport, offlineService: mockOfflineService, networkStatusProvider: mockNetworkStatusProvider, retryStrategy: defaultRetryStrategy, logger: noOpLogger, endpoint: '/api/test' });
        const item = { id: 1, name: 'test' };

        mockApiClient.fetch.mockResolvedValueOnce({ ok: true });

        adapter.syncItem(item, 'test_mutation');

        expect(mockNetworkStatusProvider.isOnline).toHaveBeenCalled();
        expect(mockApiClient.fetch).toHaveBeenCalledWith('/api/test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(item),
        });

        await Promise.resolve();

        expect(mockOfflineService.enqueueOfflineMutation).not.toHaveBeenCalled();
    });

    it('should enqueue offline mutation when offline', async () => {
        const mockNetworkStatusProvider: INetworkStatusProvider = {
            isOnline: vi.fn().mockReturnValue(false),
            getObservable: vi.fn().mockReturnValue(new Observable<NetworkStatus>({ isOnline: false, wasOffline: true }))
        };

        const transport = new ApiClientSyncTransport(mockApiClient);
        const adapter = new NetworkStorageSyncAdapter({ transport, offlineService: mockOfflineService, networkStatusProvider: mockNetworkStatusProvider, retryStrategy: defaultRetryStrategy, logger: noOpLogger, endpoint: '/api/test' });
        const item = { id: 1, name: 'test' };

        mockOfflineService.enqueueOfflineMutation.mockResolvedValueOnce(undefined);

        adapter.syncItem(item, 'test_mutation');

        await Promise.resolve();

        expect(mockNetworkStatusProvider.isOnline).toHaveBeenCalled();
        expect(mockApiClient.fetch).not.toHaveBeenCalled();
        expect(mockOfflineService.enqueueOfflineMutation).toHaveBeenCalledWith('test_mutation', item);
    });

    it('should fallback to offline queue if online fetch fails', async () => {
        const mockNetworkStatusProvider: INetworkStatusProvider = {
            isOnline: vi.fn().mockReturnValue(true),
            getObservable: vi.fn().mockReturnValue(new Observable<NetworkStatus>({ isOnline: true, wasOffline: false }))
        };

        const transport = new ApiClientSyncTransport(mockApiClient);
        const adapter = new NetworkStorageSyncAdapter({ transport, offlineService: mockOfflineService, networkStatusProvider: mockNetworkStatusProvider, retryStrategy: defaultRetryStrategy, logger: noOpLogger, endpoint: '/api/test' });
        const item = { id: 1, name: 'test' };

        mockApiClient.fetch.mockRejectedValueOnce(new Error('Network failure'));
        mockOfflineService.enqueueOfflineMutation.mockResolvedValueOnce(undefined);

        adapter.syncItem(item, 'test_mutation');

        expect(mockNetworkStatusProvider.isOnline).toHaveBeenCalled();
        expect(mockApiClient.fetch).toHaveBeenCalled();

        await Promise.resolve();
        await new Promise(process.nextTick);

        expect(mockOfflineService.enqueueOfflineMutation).toHaveBeenCalledWith('test_mutation', item);
    });

    it('should NOT enqueue offline mutation if retryStrategy drops the error', async () => {
        const mockNetworkStatusProvider: INetworkStatusProvider = {
            isOnline: vi.fn().mockReturnValue(true),
            getObservable: vi.fn().mockReturnValue(new Observable<NetworkStatus>({ isOnline: true, wasOffline: false }))
        };

        const mockRetryStrategy = {
            shouldEnqueue: vi.fn().mockReturnValue(false)
        };

        const transport = new ApiClientSyncTransport(mockApiClient);
        const adapter = new NetworkStorageSyncAdapter({ transport, offlineService: mockOfflineService, networkStatusProvider: mockNetworkStatusProvider, retryStrategy: mockRetryStrategy, logger: noOpLogger, endpoint: '/api/test' });
        const item = { id: 1, name: 'test' };

        const testError = new Error('Validation failure');
        mockApiClient.fetch.mockRejectedValueOnce(testError);

        adapter.syncItem(item, 'test_mutation');

        expect(mockNetworkStatusProvider.isOnline).toHaveBeenCalled();
        expect(mockApiClient.fetch).toHaveBeenCalled();

        await Promise.resolve();
        await new Promise(process.nextTick);

        expect(mockRetryStrategy.shouldEnqueue).toHaveBeenCalledWith(testError);
        expect(mockOfflineService.enqueueOfflineMutation).not.toHaveBeenCalled();
    });

    it('should throw SyncAdapterError when endpoint is missing', () => {
        const mockNetworkStatusProvider: INetworkStatusProvider = {
            isOnline: vi.fn().mockReturnValue(true),
            getObservable: vi.fn().mockReturnValue(new Observable<NetworkStatus>({ isOnline: true, wasOffline: false }))
        };
        const transport = new ApiClientSyncTransport(mockApiClient);
        const adapter = new NetworkStorageSyncAdapter({ transport, offlineService: mockOfflineService, networkStatusProvider: mockNetworkStatusProvider, retryStrategy: defaultRetryStrategy, logger: noOpLogger });

        expect(() => adapter.syncItem({ id: 1 }, 'test_mutation')).toThrowError(/NetworkStorageSyncAdapter: Cannot sync item, no endpoint provided/);
    });
});
