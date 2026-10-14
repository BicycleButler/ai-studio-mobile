import { registerSyncHandler, OfflineMutation } from "./offlineService";
import { apiFetch, BaseApiError } from "./apiClient";

export function initializeSyncHandlers() {
  registerSyncHandler("jules_sessions", async (mutation: OfflineMutation) => {
    try {
      await apiFetch("/api/jules/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mutation.payload),
      });
      return { success: true };
    } catch (err: unknown) {
      if (err instanceof BaseApiError && err.statusCode === 409) {
        const data = err.rawData as { remote?: unknown } | undefined;
        return { success: false, conflict: { type: mutation.type, localData: mutation.payload, remoteData: data?.remote, id: mutation.id } };
      }
      return { success: false };
    }
  });

  registerSyncHandler("saved_prompts", async (mutation: OfflineMutation) => {
    try {
      await apiFetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompts: mutation.payload }),
      });
      return { success: true };
    } catch (err: unknown) {
      if (err instanceof BaseApiError && err.statusCode === 409) {
        const data = err.rawData as { remote?: unknown } | undefined;
        return { success: false, conflict: { type: mutation.type, localData: mutation.payload, remoteData: data?.remote, id: mutation.id } };
      }
      return { success: false };
    }
  });

  registerSyncHandler("projects", async (mutation: OfflineMutation) => {
    try {
      await apiFetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projects: mutation.payload }),
      });
      return { success: true };
    } catch (err: unknown) {
      if (err instanceof BaseApiError && err.statusCode === 409) {
        const data = err.rawData as { remote?: unknown } | undefined;
        return { success: false, conflict: { type: mutation.type, localData: mutation.payload, remoteData: data?.remote, id: mutation.id } };
      }
      return { success: false };
    }
  });
}
