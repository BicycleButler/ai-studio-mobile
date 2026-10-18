import { useCallback, useSyncExternalStore } from "react";
import { StorageCollection } from "../utils/storage";
import { Observable, IReadableStore, Listener } from "../utils/observable";

export interface OfflineQueueOptions<T> {
  keyExtractor?: (item: T) => string;
  storageAdapter?: Storage;
}

export class OfflineQueueManager<T> implements IReadableStore<T[]> {
  private collection: StorageCollection<T>;
  private queue: T[];
  private observable = new Observable<T[]>();

  constructor(storageKey: string, options?: OfflineQueueOptions<T>) {
    this.collection = new StorageCollection<T>(storageKey, {
      keyExtractor: options?.keyExtractor,
      storageAdapter: options?.storageAdapter,
    });
    this.queue = this.collection.load();
  }

  public subscribe(listener: Listener<T[]>): () => void {
    return this.observable.subscribe(listener);
  }

  public getSnapshot(): T[] {
    return this.queue;
  }

  private persistAndNotify() {
    this.collection.save(this.queue);
    this.observable.notify(this.queue);
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

const managers = new Map<string, OfflineQueueManager<unknown>>();

export function getOfflineQueueManager<T>(storageKey: string, options?: OfflineQueueOptions<T>): OfflineQueueManager<T> {
  if (!managers.has(storageKey)) {
    managers.set(storageKey, new OfflineQueueManager<T>(storageKey, options) as unknown as OfflineQueueManager<unknown>);
  }
  return managers.get(storageKey) as unknown as OfflineQueueManager<T>;
}

export function useOfflineMutationQueue<T>(storageKey: string, options?: OfflineQueueOptions<T>) {
  const manager = getOfflineQueueManager<T>(storageKey, options);

  const subscribe = useCallback((listener: () => void) => {
    return manager.subscribe(listener);
  }, [manager]);

  const getSnapshot = useCallback(() => {
    return manager.getSnapshot();
  }, [manager]);

  const queue = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const enqueue = useCallback((item: T) => manager.enqueue(item), [manager]);
  const dequeue = useCallback(() => manager.dequeue(), [manager]);
  const clear = useCallback(() => manager.clear(), [manager]);

  return { queue, enqueue, dequeue, clear };
}
