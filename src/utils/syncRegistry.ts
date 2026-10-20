import { defaultOfflineService } from "./offlineService";
import { defaultClient } from "./apiClient";
import { SyncOrchestrator } from "./syncOrchestrator";

export function initializeSyncHandlers() {
  const orchestrator = new SyncOrchestrator(defaultOfflineService, defaultClient);
  orchestrator.registerHandlers();
}
