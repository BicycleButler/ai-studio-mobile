import { IOfflineService, SyncHandler, OfflineMutation } from "./offlineService";
import { IApiClient, BaseApiError } from "./apiClient";

export interface SyncHandlerConfig {
  mutationType: string;
  endpoint: string;
  method?: string;
  payloadWrapper?: (payload: unknown, mutation?: OfflineMutation) => unknown;
  requestBuilder?: (payload: unknown, method: string) => RequestInit;
  onSuccess?: (response: unknown) => void;
}

export interface ISyncOrchestrator {
  createGenericSyncHandler(
    endpoint: string,
    payloadWrapper?: (payload: unknown, mutation?: OfflineMutation) => unknown,
    method?: string,
    requestBuilder?: (payload: unknown, method: string) => RequestInit,
    onSuccess?: (response: unknown) => void
  ): SyncHandler;
  registerHandlers(): void;
}

export class SyncOrchestrator implements ISyncOrchestrator {
  constructor(
    private offlineService: IOfflineService,
    private apiClient: IApiClient,
    private handlersConfig: SyncHandlerConfig[] = []
  ) {}

  public createGenericSyncHandler(
    endpoint: string,
    payloadWrapper?: (payload: unknown, mutation?: OfflineMutation) => unknown,
    method: string = "POST",
    requestBuilder?: (payload: unknown, method: string) => RequestInit,
    onSuccess?: (response: unknown) => void
  ): SyncHandler {
    return async (mutation: OfflineMutation) => {
      try {
        const bodyPayload = payloadWrapper ? payloadWrapper(mutation.payload, mutation) : mutation.payload;
        const requestInit = requestBuilder ? requestBuilder(bodyPayload, method) : {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload),
        };
        const response = await this.apiClient.fetch(endpoint, requestInit);
        onSuccess?.(response);
        return { success: true };
      } catch (err: unknown) {
        if (err instanceof BaseApiError) {
          if (err.statusCode === 409) {
            const data = err.rawData as { remote?: unknown; remoteVersion?: number } | undefined;
            return {
              success: false,
              retryable: false,
              conflict: {
                type: mutation.type,
                localData: mutation.payload,
                remoteData: data?.remote,
                remoteVersion: typeof data?.remoteVersion === "number" ? data.remoteVersion : undefined,
                id: mutation.id
              }
            };
          }
          if (!err.isRetryable()) {
            return { success: false, retryable: false };
          }
        }
        return { success: false, retryable: true };
      }
    };
  }

  public registerHandlers(): void {
    this.handlersConfig.forEach((config) => {
      this.offlineService.registerSyncHandler(
        config.mutationType,
        this.createGenericSyncHandler(
          config.endpoint,
          config.payloadWrapper,
          config.method,
          config.requestBuilder,
          config.onSuccess
        )
      );
    });
  }
}
