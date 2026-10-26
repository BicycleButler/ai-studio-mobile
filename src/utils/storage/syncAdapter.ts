import { IOfflineService } from "../offlineService";
import { IApiClient } from "../apiClient";
import { INetworkStatusProvider } from "../networkStatus";
import { IOfflineRetryStrategy } from "./offlineRetryStrategy";
import { ILogger } from "../logger";

export interface IStorageSyncAdapter<T> {
  syncItem(item: T, endpoint: string, mutationType: string, method?: string): void;
}

export interface ISyncTransport<T> {
  transmit(endpoint: string, item: T, method: string): Promise<void>;
}

export class ApiClientSyncTransport<T> implements ISyncTransport<T> {
  constructor(
    private apiClient: IApiClient,
    private requestBuilder?: (item: T, method: string) => RequestInit
  ) {
    this.requestBuilder = requestBuilder || ((item: T, method: string) => ({
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    }));
  }

  public async transmit(endpoint: string, item: T, method: string): Promise<void> {
    await this.apiClient.fetch(endpoint, this.requestBuilder!(item, method));
  }
}

export interface NetworkStorageSyncAdapterConfig<T> {
  transport: ISyncTransport<T>;
  offlineService: IOfflineService;
  networkStatusProvider: INetworkStatusProvider;
  retryStrategy: IOfflineRetryStrategy;
  logger: ILogger;
}

export class NetworkStorageSyncAdapter<T> implements IStorageSyncAdapter<T> {
  private retryStrategy: IOfflineRetryStrategy;
  private transport: ISyncTransport<T>;
  private offlineService: IOfflineService;
  private networkStatusProvider: INetworkStatusProvider;
  private logger: ILogger;

  constructor(config: NetworkStorageSyncAdapterConfig<T>) {
    this.transport = config.transport;
    this.offlineService = config.offlineService;
    this.networkStatusProvider = config.networkStatusProvider;
    this.retryStrategy = config.retryStrategy;
    this.logger = config.logger;
  }

  public syncItem(item: T, endpoint: string, mutationType: string, method: string = "POST"): void {
    if (this.networkStatusProvider.isOnline()) {
      this.transport.transmit(endpoint, item, method).catch((e) => {
        if (this.retryStrategy.shouldEnqueue(e)) {
          this.logger.debug(`Failed to save ${mutationType} to server, falling back to offline queue`, e);
          this.offlineService.enqueueOfflineMutation(mutationType, item).catch((err) => this.logger.error("Failed to enqueue offline mutation", err));
        } else {
          this.logger.error(`Failed to save ${mutationType} to server. Error is not retryable, dropping sync.`, e);
        }
      });
    } else {
      this.offlineService.enqueueOfflineMutation(mutationType, item).catch((err) => this.logger.error("Failed to enqueue offline mutation", err));
    }
  }
}
