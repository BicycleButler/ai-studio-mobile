import { useCallback, useSyncExternalStore } from "react";
import { StorageCollection } from "../utils/storage";
import { Observable } from "../utils/observable";

class OfflineQueueManager<T extends { id: string }> extends Observable<T[]> {
  private collection: StorageCollection<T>;
  private queue: T[];

  constructor(storageKey: string) {
    super();
    this.collection = new StorageCollection<T>(storageKey, {});
    this.queue = this.collection.load();
  }

  // Bind subscribe to instance for useSyncExternalStore
  public bindSubscribe = (listener: () => void) => {
    return this.subscribe(listener);
  };

  public getSnapshot = () => {
    return this.queue;
  };

  private persistAndNotify() {
    this.collection.save(this.queue);
    // Overriding Observable's notify, but use the base class method to dispatch
    this.notify(this.queue);
  }

  public enqueue = (item: T) => {
    this.queue = [...this.queue, item];
    this.persistAndNotify();
  };

  public dequeue = () => {
    this.queue = this.queue.slice(1);
    this.persistAndNotify();
  };

  public clear = () => {
    this.queue = [];
    this.persistAndNotify();
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
  const queue = useSyncExternalStore(manager.bindSubscribe, manager.getSnapshot, manager.getSnapshot);

  const enqueue = useCallback((item: T) => manager.enqueue(item), [manager]);
  const dequeue = useCallback(() => manager.dequeue(), [manager]);
  const clear = useCallback(() => manager.clear(), [manager]);

  return { queue, enqueue, dequeue, clear };
}
