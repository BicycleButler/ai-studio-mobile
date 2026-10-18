import { useSyncExternalStore } from "react";
import { queueObservable, getOfflineQueue, OfflineMutation } from "../utils/offlineService";

// Fetch initial data exactly once so `useSyncExternalStore` has a synchronous snapshot
let cachedQueue: OfflineMutation[] = [];
let initialized = false;

getOfflineQueue().then((q) => {
  cachedQueue = q;
  initialized = true;
  queueObservable.notify(q);
});

export function useOfflineQueue(): OfflineMutation[] {
  return useSyncExternalStore(
    queueObservable.bindSubscribe,
    () => (initialized ? queueObservable.getSnapshot() || cachedQueue : cachedQueue),
    () => (initialized ? queueObservable.getSnapshot() || cachedQueue : cachedQueue)
  );
}
