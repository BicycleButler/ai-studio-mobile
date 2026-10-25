import { useSyncExternalStore, useCallback } from "react";
import { IOfflineService, OfflineMutation } from "../utils/offlineService";

import { useServices } from "../services/ServiceContext";
export function useOfflineQueue(customOfflineService?: IOfflineService): OfflineMutation[] {
  const { offlineService: contextOfflineService } = useServices();
  const offlineService = customOfflineService || contextOfflineService;
  const subscribe = useCallback((listener: () => void) => {
    return offlineService.getObservable().subscribe(listener);
  }, [offlineService]);

  const getSnapshot = useCallback(() => {
    return offlineService.getSnapshot();
  }, [offlineService]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
