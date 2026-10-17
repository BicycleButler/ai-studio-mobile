import { useSyncExternalStore } from "react";
import { StorageBase } from "../StorageBase";

/**
 * A React hook that subscribes to a StorageBase instance (StorageCollection or StorageSingleton).
 * It automatically updates the component when the underlying storage changes across tabs or windows.
 *
 * @param storageInstance The StorageBase instance to subscribe to
 * @returns The current state of the storage snapshot
 */
export function useStorage<T>(storageInstance: StorageBase<T>): T {
  return useSyncExternalStore(
    storageInstance.bindSubscribe,
    storageInstance.getSnapshot,
    storageInstance.getSnapshot
  );
}
