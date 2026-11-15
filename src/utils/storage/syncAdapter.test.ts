import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NetworkStorageSyncAdapter, ApiClientSyncTransport } from './syncAdapter';
import { IApiClient, BaseApiError } from '../apiClient';
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

    it('should coalesce rapid successive syncItem calls while a transmit is in flight', async () => {
        const mockNetworkStatusProvider: INetworkStatusProvider = {
            isOnline: vi.fn().mockReturnValue(true),
            getObservable: vi.fn().mockReturnValue(new Observable<NetworkStatus>({ isOnline: true, wasOffline: false }))
        };

        let resolveFirst!: (val: unknown) => void;
        const firstPromise = new Promise((resolve) => {
            resolveFirst = resolve;
        });

        mockApiClient.fetch
            .mockReturnValueOnce(firstPromise as Promise<unknown>)
            .mockResolvedValueOnce({ ok: true });

        const transport = new ApiClientSyncTransport(mockApiClient);
        const adapter = new NetworkStorageSyncAdapter({
            transport,
            offlineService: mockOfflineService,
            networkStatusProvider: mockNetworkStatusProvider,
            retryStrategy: defaultRetryStrategy,
            logger: noOpLogger,
            endpoint: '/api/test',
            method: 'PUT',
        });

        adapter.syncItem({ v: 1 }, 'prompts');
        adapter.syncItem({ v: 2 }, 'prompts');
        adapter.syncItem({ v: 3 }, 'prompts');

        // Only the first request is in-flight initially; v: 2 was superseded by v: 3
        expect(mockApiClient.fetch).toHaveBeenCalledTimes(1);

        resolveFirst({ ok: true });
        await new Promise((r) => setTimeout(r, 10));

        expect(mockApiClient.fetch).toHaveBeenCalledTimes(2);
        expect(mockApiClient.fetch).toHaveBeenNthCalledWith(
            2,
            '/api/test',
            expect.objectContaining({
                method: 'PUT',
                body: JSON.stringify({ v: 3 }),
            })
        );
    });

    it('should forward remote and remoteVersion to onConflict on 409 response', async () => {
        const mockNetworkStatusProvider: INetworkStatusProvider = {
            isOnline: vi.fn().mockReturnValue(true),
            getObservable: vi.fn().mockReturnValue(new Observable<NetworkStatus>({ isOnline: true, wasOffline: false }))
        };
        const onConflict = vi.fn();

        const conflictErr = BaseApiError.fromResponse('Conflict', 409, undefined, '/api/test', {
            remote: [{ id: 'r1' }],
            remoteVersion: 9,
        });
        mockApiClient.fetch.mockRejectedValueOnce(conflictErr);

        const transport = new ApiClientSyncTransport(mockApiClient);
        const adapter = new NetworkStorageSyncAdapter({
            transport,
            offlineService: mockOfflineService,
            networkStatusProvider: mockNetworkStatusProvider,
            retryStrategy: defaultRetryStrategy,
            logger: noOpLogger,
            endpoint: '/api/test',
            onConflict,
        });

        adapter.syncItem([{ id: 'l1' }], 'projects');
        await new Promise((r) => setTimeout(r, 10));

        expect(onConflict).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'projects',
                localData: [{ id: 'l1' }],
                remoteData: [{ id: 'r1' }],
                remoteVersion: 9,
            })
        );
    });

    it('enqueues coalesced pending mutation behind failed in-flight transmit instead of bypassing FIFO order', async () => {
        const mockNetworkStatusProvider: INetworkStatusProvider = {
            isOnline: vi.fn().mockReturnValue(true),
            getObservable: vi.fn().mockReturnValue(new Observable<NetworkStatus>({ isOnline: true, wasOffline: false }))
        };

        let rejectFirst!: (err: Error) => void;
        const firstPromise = new Promise((_, reject) => {
            rejectFirst = reject;
        });

        mockApiClient.fetch.mockReturnValueOnce(firstPromise as Promise<unknown>);
        mockOfflineService.enqueueOfflineMutation.mockResolvedValue(undefined);

        const transport = new ApiClientSyncTransport(mockApiClient);
        const adapter = new NetworkStorageSyncAdapter({
            transport,
            offlineService: mockOfflineService,
            networkStatusProvider: mockNetworkStatusProvider,
            retryStrategy: defaultRetryStrategy,
            logger: noOpLogger,
            endpoint: '/api/prompts',
            method: 'PUT',
        });

        adapter.syncItem({ v: 1 }, 'saved_prompts');
        adapter.syncItem({ v: 2 }, 'saved_prompts');

        rejectFirst(new Error('Connection reset'));
        await new Promise((r) => setTimeout(r, 15));

        // Second item must NOT be transmitted directly over HTTP out-of-order; both must be enqueued FIFO
        expect(mockApiClient.fetch).toHaveBeenCalledTimes(1);
        expect(mockOfflineService.enqueueOfflineMutation).toHaveBeenNthCalledWith(1, 'saved_prompts', { v: 1 });
        expect(mockOfflineService.enqueueOfflineMutation).toHaveBeenNthCalledWith(2, 'saved_prompts', { v: 2 });
    });
});
