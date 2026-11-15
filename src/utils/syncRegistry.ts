import { SyncOrchestrator, SyncHandlerConfig } from "./syncOrchestrator";
import { IOfflineService, OfflineMutation } from "./offlineService";
import { IApiClient } from "./apiClient";
import { syncVersionTracker } from "./syncVersionTracker";

function sanitizeProjectsForSync(payload: unknown): unknown {
  if (!Array.isArray(payload)) return payload;
  return payload.map((item) => {
    if (item && typeof item === "object") {
      const { apiKey: _omitted, ...rest } = item as Record<string, unknown>;
      return rest;
    }
    return item;
  });
}

export const DEFAULT_SYNC_HANDLERS: SyncHandlerConfig[] = [
  {
    mutationType: "saved_prompts",
    endpoint: "/api/prompts",
    payloadWrapper: (payload: unknown, mutation?: OfflineMutation) => ({
      prompts: payload,
      ...(mutation?.version === -1
        ? { force: true }
        : syncVersionTracker.getVersion("prompts") !== undefined
          ? { baseVersion: syncVersionTracker.getVersion("prompts") }
          : {}),
    }),
    onSuccess: (res: unknown) => {
      const version = (res as { version?: number } | null)?.version;
      syncVersionTracker.setVersion("prompts", version);
    },
  },
  {
    mutationType: "projects",
    endpoint: "/api/projects",
    payloadWrapper: (payload: unknown, mutation?: OfflineMutation) => ({
      projects: sanitizeProjectsForSync(payload),
      ...(mutation?.version === -1
        ? { force: true }
        : syncVersionTracker.getVersion("projects") !== undefined
          ? { baseVersion: syncVersionTracker.getVersion("projects") }
          : {}),
    }),
    onSuccess: (res: unknown) => {
      const version = (res as { version?: number } | null)?.version;
      syncVersionTracker.setVersion("projects", version);
    },
  },
];

export function initializeSyncHandlers(offlineService: IOfflineService, apiClient: IApiClient) {
  const orchestrator = new SyncOrchestrator(offlineService, apiClient, DEFAULT_SYNC_HANDLERS);
  orchestrator.registerHandlers();
}
