import { IOfflineService } from "../offlineService";
import { IApiClient } from "../apiClient";
import { INetworkStatusProvider } from "../networkStatus";
import { IOfflineRetryStrategy } from "./offlineRetryStrategy";
import { ILogger, defaultLogger } from "../logger";

export interface IStorageSyncAdapter<T> {
  syncItem(item: T, endpoint: string, mutationType: string, method?: string): void;
}

export interface NetworkStorageSyncAdapterConfig<T> {
  apiClient: IApiClient;
  offlineService: IOfflineService;
  networkStatusProvider: INetworkStatusProvider;
  retryStrategy: IOfflineRetryStrategy;
  logger?: ILogger;
  requestBuilder?: (item: T, method: string) => RequestInit;
}

export class NetworkStorageSyncAdapter<T> implements IStorageSyncAdapter<T> {
  private retryStrategy: IOfflineRetryStrategy;
  private apiClient: IApiClient;
  private offlineService: IOfflineService;
  private networkStatusProvider: INetworkStatusProvider;
  private logger: ILogger;
  private requestBuilder: (item: T, method: string) => RequestInit;

  constructor(config: NetworkStorageSyncAdapterConfig<T>) {
    this.apiClient = config.apiClient;
    this.offlineService = config.offlineService;
    this.networkStatusProvider = config.networkStatusProvider;
    this.retryStrategy = config.retryStrategy;
    this.logger = config.logger || defaultLogger;
    this.requestBuilder = config.requestBuilder || ((item, method) => ({
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    }));
  }

  public syncItem(item: T, endpoint: string, mutationType: string, method: string = "POST"): void {
    if (this.networkStatusProvider.isOnline()) {
      this.apiClient.fetch(endpoint, this.requestBuilder(item, method)).catch((e) => {
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
