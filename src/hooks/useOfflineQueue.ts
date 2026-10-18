import { useSyncExternalStore, useCallback } from "react";
import { queueObservable, defaultOfflineService, OfflineMutation } from "../utils/offlineService";

export function useOfflineQueue(): OfflineMutation[] {
  const subscribe = useCallback((listener: () => void) => {
    return queueObservable.subscribe(listener);
  }, []);

  const getSnapshot = useCallback(() => {
    return defaultOfflineService.getSnapshot();
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
