import { useSyncExternalStore, useCallback } from "react";
import { StorageBase } from "./StorageBase";

/**
 * A React hook that subscribes to a StorageBase instance (StorageCollection or StorageSingleton).
 * It automatically updates the component when the underlying storage changes across tabs or windows.
 *
 * @param storageInstance The StorageBase instance to subscribe to
 * @returns The current state of the storage snapshot
 */
export function useStorage<T>(storageInstance: StorageBase<T>): T {
  const subscribe = useCallback((listener: () => void) => {
    return storageInstance.subscribe(listener);
  }, [storageInstance]);

  const getSnapshot = useCallback(() => {
    return storageInstance.getSnapshot();
  }, [storageInstance]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
