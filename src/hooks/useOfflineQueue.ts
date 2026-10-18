import { useSyncExternalStore } from "react";
import { queueObservable, defaultOfflineService, OfflineMutation } from "../utils/offlineService";

export function useOfflineQueue(): OfflineMutation[] {
  return useSyncExternalStore(
    queueObservable.bindSubscribe,
    () => defaultOfflineService.getSnapshot(),
    () => defaultOfflineService.getSnapshot()
  );
}
