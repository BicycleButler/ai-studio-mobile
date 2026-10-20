import { isBrowserEnvironment, getSafeWindow } from "../platform";
import { IOfflineService } from "../offlineService";
import { IApiClient } from "../apiClient";

export interface IStorageSyncAdapter<T> {
  syncItem(item: T, endpoint: string, mutationType: string): void;
}

export class NetworkStorageSyncAdapter<T> implements IStorageSyncAdapter<T> {
  constructor(
    private apiClient: IApiClient,
    private offlineService: IOfflineService
  ) {}

  public syncItem(item: T, endpoint: string, mutationType: string): void {
    if (isBrowserEnvironment()) {
      const win = getSafeWindow();
      const isOnline = win && typeof win.navigator.onLine === "boolean" ? win.navigator.onLine : true;

      if (isOnline) {
        this.apiClient.fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(item),
        }).catch((e) => {
          console.error(`Failed to save ${mutationType} to server, falling back to offline queue`, e);
          this.offlineService.enqueueOfflineMutation(mutationType, item).catch(console.error);
        });
      } else {
        this.offlineService.enqueueOfflineMutation(mutationType, item).catch(console.error);
      }
    }
  }
}
