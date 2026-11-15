import { IOfflineService, ConflictData } from "../offlineService";
import { IApiClient, BaseApiError } from "../apiClient";
import { INetworkStatusProvider } from "../networkStatus";
import { IOfflineRetryStrategy } from "./offlineRetryStrategy";
import { ILogger } from "../logger";
import { SyncAdapterError } from "./syncAdapterErrors";
import { errorReporter } from "../errorReporter";

export interface IStorageSyncAdapter<T> {
  syncItem(item: T, mutationType: string, endpoint?: string, method?: string): void;
}

export interface ISyncTransport<T> {
  transmit(endpoint: string, item: T, method: string): Promise<void>;
}

export class ApiClientSyncTransport<T> implements ISyncTransport<T> {
  constructor(
    private apiClient: IApiClient,
    private requestBuilder?: (item: T, method: string) => RequestInit,
    private onSuccess?: (response: unknown) => void
  ) {
    this.requestBuilder = requestBuilder || ((item: T, method: string) => ({
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    }));
  }

  public async transmit(endpoint: string, item: T, method: string): Promise<void> {
    const res = await this.apiClient.fetch(endpoint, this.requestBuilder!(item, method));
    this.onSuccess?.(res);
  }
}

export interface NetworkStorageSyncAdapterConfig<T> {
  transport: ISyncTransport<T>;
  offlineService: IOfflineService;
  networkStatusProvider: INetworkStatusProvider;
  retryStrategy: IOfflineRetryStrategy;
  logger: ILogger;
  endpoint?: string;
  method?: string;
  onConflict?: (conflict: ConflictData) => void;
}

export class NetworkStorageSyncAdapter<T> implements IStorageSyncAdapter<T> {
  private retryStrategy: IOfflineRetryStrategy;
  private transport: ISyncTransport<T>;
  private offlineService: IOfflineService;
  private networkStatusProvider: INetworkStatusProvider;
  private logger: ILogger;
  private defaultEndpoint?: string;
  private defaultMethod: string;
  private onConflict?: (conflict: ConflictData) => void;
  private inFlightByType = new Map<string, Promise<void>>();
  private pendingByType = new Map<string, { item: T; endpoint: string; method: string }>();

  constructor(config: NetworkStorageSyncAdapterConfig<T>) {
    this.transport = config.transport;
    this.offlineService = config.offlineService;
    this.networkStatusProvider = config.networkStatusProvider;
    this.retryStrategy = config.retryStrategy;
    this.logger = config.logger;
    this.defaultEndpoint = config.endpoint;
    this.defaultMethod = config.method || "POST";
    this.onConflict = config.onConflict;
  }

  private hasQueuedOfflineMutations(mutationType: string): boolean {
    if (typeof this.offlineService.getSnapshot !== "function") {
      return false;
    }
    const snapshot = this.offlineService.getSnapshot();
    return Array.isArray(snapshot) && snapshot.some((m) => m.type === mutationType);
  }

  private dispatchTransmit(item: T, mutationType: string, endpoint: string, method: string): void {
    let fallbackEnqueued = false;

    const run = async (currItem: T, currEndpoint: string, currMethod: string): Promise<void> => {
      try {
        await this.transport.transmit(currEndpoint, currItem, currMethod);
      } catch (e) {
        if (e instanceof BaseApiError && e.statusCode === 409) {
          this.pendingByType.delete(mutationType);
          const data = e.rawData as { remote?: unknown; remoteVersion?: number } | undefined;
          errorReporter.report("sync_conflict", `Sync conflict for ${mutationType}`, {
            scope: mutationType,
          });
          this.onConflict?.({
            type: mutationType,
            localData: currItem,
            remoteData: data?.remote,
            remoteVersion: typeof data?.remoteVersion === "number" ? data.remoteVersion : undefined,
            id: `conflict_${Date.now()}`,
          });
          return;
        }
        if (this.retryStrategy.shouldEnqueue(e)) {
          fallbackEnqueued = true;
          this.logger.debug(`Failed to save ${mutationType} to server, falling back to offline queue`, e);
          await this.offlineService.enqueueOfflineMutation(mutationType, currItem).catch((err) =>
            this.logger.error("Failed to enqueue offline mutation", err)
          );
        } else {
          const msg = e instanceof Error ? e.message : String(e);
          this.logger.error(`Failed to save ${mutationType} to server. Error is not retryable, dropping sync.`, e);
          errorReporter.report("sync_dropped", `Dropped non-retryable ${mutationType} sync: ${msg}`, {
            scope: mutationType,
            ...(e instanceof BaseApiError && e.statusCode ? { statusCode: e.statusCode } : {}),
          });
        }
      }
    };

    const promise = run(item, endpoint, method).finally(() => {
      const next = this.pendingByType.get(mutationType);
      if (!next) {
        this.inFlightByType.delete(mutationType);
        return;
      }
      this.pendingByType.delete(mutationType);
      if (fallbackEnqueued || !this.networkStatusProvider.isOnline() || this.hasQueuedOfflineMutations(mutationType)) {
        this.inFlightByType.delete(mutationType);
        this.offlineService
          .enqueueOfflineMutation(mutationType, next.item)
          .catch((err) => this.logger.error("Failed to enqueue offline mutation", err));
        return;
      }
      this.dispatchTransmit(next.item, mutationType, next.endpoint, next.method);
    });

    this.inFlightByType.set(mutationType, promise);
  }

  public syncItem(item: T, mutationType: string, endpoint?: string, method?: string): void {
    const finalEndpoint = endpoint || this.defaultEndpoint;
    const finalMethod = method || this.defaultMethod;

    if (!finalEndpoint) {
        throw new SyncAdapterError(`NetworkStorageSyncAdapter: Cannot sync item, no endpoint provided and no default endpoint configured for mutation type ${mutationType}.`, endpoint);
    }

    if (this.networkStatusProvider.isOnline()) {
      if (this.inFlightByType.has(mutationType)) {
        // Coalesce rapid successive mutations while an identical resource type sync is in flight
        this.pendingByType.set(mutationType, { item, endpoint: finalEndpoint, method: finalMethod });
        return;
      }
      if (this.hasQueuedOfflineMutations(mutationType)) {
        // Preserve FIFO ordering behind already-queued offline mutations
        this.offlineService.enqueueOfflineMutation(mutationType, item).catch((err) => this.logger.error("Failed to enqueue offline mutation", err));
        return;
      }
      this.dispatchTransmit(item, mutationType, finalEndpoint, finalMethod);
    } else {
      this.offlineService.enqueueOfflineMutation(mutationType, item).catch((err) => this.logger.error("Failed to enqueue offline mutation", err));
    }
  }
}
