import { useCallback, useSyncExternalStore } from "react";
import { StorageCollection } from "../utils/storage";

class OfflineQueueManager<T extends { id: string }> {
  private collection: StorageCollection<T>;
  private queue: T[];
  private listeners = new Set<() => void>();

  constructor(storageKey: string) {
    this.collection = new StorageCollection<T>(storageKey, {});
    this.queue = this.collection.load();
  }

  public subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public getSnapshot = () => {
    return this.queue;
  };

  private notify() {
    this.collection.save(this.queue);
    for (const listener of this.listeners) {
      listener();
    }
  }

  public enqueue = (item: T) => {
    this.queue = [...this.queue, item];
    this.notify();
  };

  public dequeue = () => {
    this.queue = this.queue.slice(1);
    this.notify();
  };

  public clear = () => {
    this.queue = [];
    this.notify();
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const managers = new Map<string, OfflineQueueManager<any>>();

function getManager<T extends { id: string }>(storageKey: string): OfflineQueueManager<T> {
  if (!managers.has(storageKey)) {
    managers.set(storageKey, new OfflineQueueManager<T>(storageKey));
  }
  return managers.get(storageKey) as OfflineQueueManager<T>;
}

export function useOfflineMutationQueue<T extends { id: string }>(storageKey: string) {
  const manager = getManager<T>(storageKey);
  const queue = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getSnapshot);

  const enqueue = useCallback((item: T) => manager.enqueue(item), [manager]);
  const dequeue = useCallback(() => manager.dequeue(), [manager]);
  const clear = useCallback(() => manager.clear(), [manager]);

  return { queue, enqueue, dequeue, clear };
}
