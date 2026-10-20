import { IOfflineService, SyncHandler, OfflineMutation } from "./offlineService";
import { IApiClient, BaseApiError } from "./apiClient";

export class SyncOrchestrator {
  constructor(
    private offlineService: IOfflineService,
    private apiClient: IApiClient
  ) {}

  public createGenericSyncHandler(endpoint: string, payloadWrapper?: (payload: unknown) => unknown): SyncHandler {
    return async (mutation: OfflineMutation) => {
      try {
        const bodyPayload = payloadWrapper ? payloadWrapper(mutation.payload) : mutation.payload;
        await this.apiClient.fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload),
        });
        return { success: true };
      } catch (err: unknown) {
        if (err instanceof BaseApiError && err.statusCode === 409) {
          const data = err.rawData as { remote?: unknown } | undefined;
          return {
            success: false,
            conflict: {
              type: mutation.type,
              localData: mutation.payload,
              remoteData: data?.remote,
              id: mutation.id
            }
          };
        }
        return { success: false };
      }
    };
  }

  public registerHandlers(): void {
    this.offlineService.registerSyncHandler("jules_sessions", this.createGenericSyncHandler("/api/jules/sessions"));
    this.offlineService.registerSyncHandler("saved_prompts", this.createGenericSyncHandler("/api/prompts", (payload) => ({ prompts: payload })));
    this.offlineService.registerSyncHandler("projects", this.createGenericSyncHandler("/api/projects", (payload) => ({ projects: payload })));
  }
}
