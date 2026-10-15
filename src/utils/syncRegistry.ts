import { registerSyncHandler, OfflineMutation } from "./offlineService";
import { apiFetch, BaseApiError } from "./apiClient";

function createGenericSyncHandler(endpoint: string, payloadWrapper?: (payload: unknown) => unknown) {
  return async (mutation: OfflineMutation) => {
    try {
      const bodyPayload = payloadWrapper ? payloadWrapper(mutation.payload) : mutation.payload;
      await apiFetch(endpoint, {
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

export function initializeSyncHandlers() {
  registerSyncHandler("jules_sessions", createGenericSyncHandler("/api/jules/sessions"));
  registerSyncHandler("saved_prompts", createGenericSyncHandler("/api/prompts", (payload) => ({ prompts: payload })));
  registerSyncHandler("projects", createGenericSyncHandler("/api/projects", (payload) => ({ projects: payload })));
}
