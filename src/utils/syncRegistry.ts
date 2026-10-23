import { defaultOfflineService } from "./offlineService";
import { defaultClient } from "./apiClient";
import { SyncOrchestrator } from "./syncOrchestrator";

import { IOfflineService } from "./offlineService";
import { IApiClient } from "./apiClient";

export function initializeSyncHandlers(offlineService: IOfflineService = defaultOfflineService, apiClient: IApiClient = defaultClient) {
  const orchestrator = new SyncOrchestrator(offlineService, apiClient);
  orchestrator.registerHandlers();
}
