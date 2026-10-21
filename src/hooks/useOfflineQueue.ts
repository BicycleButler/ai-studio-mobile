import { useSyncExternalStore, useCallback } from "react";
import { IOfflineService, defaultOfflineService, OfflineMutation } from "../utils/offlineService";

export function useOfflineQueue(offlineService: IOfflineService = defaultOfflineService): OfflineMutation[] {
  const subscribe = useCallback((listener: () => void) => {
    return offlineService.queueObservable.subscribe(listener);
  }, [offlineService]);

  const getSnapshot = useCallback(() => {
    return offlineService.getSnapshot();
  }, [offlineService]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
