import { IOfflineService } from "../offlineService";
import { IApiClient } from "../apiClient";
import { INetworkStatusProvider, BrowserNetworkStatusProvider } from "../networkStatus";
import { IOfflineRetryStrategy, DefaultOfflineRetryStrategy } from "./offlineRetryStrategy";

export interface IStorageSyncAdapter<T> {
  syncItem(item: T, endpoint: string, mutationType: string): void;
}

export class NetworkStorageSyncAdapter<T> implements IStorageSyncAdapter<T> {
  private retryStrategy: IOfflineRetryStrategy;

  constructor(
    private apiClient: IApiClient,
    private offlineService: IOfflineService,
    private networkStatusProvider: INetworkStatusProvider = new BrowserNetworkStatusProvider(),
    retryStrategy?: IOfflineRetryStrategy
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
          console.debug(`Failed to save ${mutationType} to server, falling back to offline queue`, e);
          this.offlineService.enqueueOfflineMutation(mutationType, item).catch(console.error);
        } else {
          console.error(`Failed to save ${mutationType} to server. Error is not retryable, dropping sync.`, e);
        }
      });
    } else {
      this.offlineService.enqueueOfflineMutation(mutationType, item).catch(console.error);
    }
  }
}
