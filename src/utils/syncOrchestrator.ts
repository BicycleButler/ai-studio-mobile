import { IOfflineService, SyncHandler, OfflineMutation } from "./offlineService";
import { IApiClient, BaseApiError } from "./apiClient";
import { ISerializer } from "./storage/serializer";

export interface SyncHandlerConfig {
  mutationType: string;
  endpoint: string;
  method?: string;
  payloadWrapper?: (payload: unknown) => unknown;
  requestBuilder?: (payload: unknown, method: string) => RequestInit;
  serializer?: ISerializer;
}

export interface ISyncOrchestrator {
  createGenericSyncHandler(
    endpoint: string,
    payloadWrapper?: (payload: unknown) => unknown,
    method?: string,
    requestBuilder?: (payload: unknown, method: string) => RequestInit,
    serializer?: ISerializer
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
    payloadWrapper?: (payload: unknown) => unknown,
    method: string = "POST",
    requestBuilder?: (payload: unknown, method: string) => RequestInit,
    serializer?: ISerializer
  ): SyncHandler {
    return async (mutation: OfflineMutation) => {
      try {
        const bodyPayload = payloadWrapper ? payloadWrapper(mutation.payload) : mutation.payload;

        const requestInit = requestBuilder ? requestBuilder(bodyPayload, method) : {
          method,
          headers: { "Content-Type": "application/json" },
          body: serializer ? serializer.serialize(bodyPayload) : JSON.stringify(bodyPayload),
        };
        await this.apiClient.fetch(endpoint, requestInit);
        return { success: true };
      } catch (err: unknown) {
        if (err instanceof BaseApiError) {
          if (err.statusCode === 409) {
            const data = err.rawData as { remote?: unknown } | undefined;
            return {
              success: false,
              retryable: false,
              conflict: {
                type: mutation.type,
                localData: mutation.payload,
                remoteData: data?.remote,
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
        this.createGenericSyncHandler(config.endpoint, config.payloadWrapper, config.method, config.requestBuilder, config.serializer)
      );
    });
  }
}
