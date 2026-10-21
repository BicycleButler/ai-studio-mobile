import { IOfflineService } from "../offlineService";
import { IApiClient } from "../apiClient";
import { INetworkStatusProvider, BrowserNetworkStatusProvider } from "../networkStatus";
import { IOfflineRetryStrategy, DefaultOfflineRetryStrategy } from "./offlineRetryStrategy";
import { ILogger, defaultLogger } from "../logger";

export interface IStorageSyncAdapter<T> {
  syncItem(item: T, endpoint: string, mutationType: string): void;
}

export class NetworkStorageSyncAdapter<T> implements IStorageSyncAdapter<T> {
  private retryStrategy: IOfflineRetryStrategy;

  constructor(
    private apiClient: IApiClient,
    private offlineService: IOfflineService,
    private networkStatusProvider: INetworkStatusProvider = new BrowserNetworkStatusProvider(),
    retryStrategy?: IOfflineRetryStrategy,
    private logger: ILogger = defaultLogger
  ) {
    this.retryStrategy = retryStrategy || new DefaultOfflineRetryStrategy();
  }

  public syncItem(item: T, endpoint: string, mutationType: string): void {
    if (this.networkStatusProvider.isOnline()) {
      this.apiClient.fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(item),
      }).catch((e) => {
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
