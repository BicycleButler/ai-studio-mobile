import { defaultOfflineService } from "./offlineService";
import { defaultClient } from "./apiClient";
import { SyncOrchestrator, SyncHandlerConfig } from "./syncOrchestrator";

import { IOfflineService } from "./offlineService";
import { IApiClient } from "./apiClient";

export const DEFAULT_SYNC_HANDLERS: SyncHandlerConfig[] = [
  { mutationType: "jules_sessions", endpoint: "/api/jules/sessions" },
  { mutationType: "saved_prompts", endpoint: "/api/prompts", payloadWrapper: (payload: unknown) => ({ prompts: payload }) },
  { mutationType: "projects", endpoint: "/api/projects", payloadWrapper: (payload: unknown) => ({ projects: payload }) }
];

export function initializeSyncHandlers(offlineService: IOfflineService = defaultOfflineService, apiClient: IApiClient = defaultClient) {
  const orchestrator = new SyncOrchestrator(offlineService, apiClient, DEFAULT_SYNC_HANDLERS);
  orchestrator.registerHandlers();
}
