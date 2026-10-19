import { useSyncExternalStore, useCallback } from "react";
import { IReadableStore } from "../observable";

/**
 * A React hook that subscribes to a StorageEngine instance (StorageCollection or StorageSingleton).
 * It automatically updates the component when the underlying storage changes across tabs or windows.
 *
 * @param storageInstance The StorageEngine instance to subscribe to
 * @returns The current state of the storage snapshot
 */
export function useStorage<T>(storageInstance: IReadableStore<T>): T {
  const subscribe = useCallback((listener: () => void) => {
    return storageInstance.subscribe(listener);
  }, [storageInstance]);

  const getSnapshot = useCallback(() => {
    return storageInstance.getSnapshot() as T;
  }, [storageInstance]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
