import { IMutableCollection, IMutableSingleton } from "./types";
import { StorageCollection, StorageCollectionOptions } from "./StorageCollection";
import { StorageSingleton, StorageSingletonOptions } from "./StorageSingleton";
import { StorageRegistry, IStorageRegistry } from "./StorageRegistry";
import { MapCollection } from "./MapCollection";
import { DefaultStorageAdapter, createDefaultStorageInstance } from "./core";
import { defaultLogger } from "../logger";

export interface IStorageFactory {
  createCollection<T>(key: string, options?: StorageCollectionOptions<T>): IMutableCollection<T>;
  createSingleton<T>(key: string, fallback: T, options?: StorageSingletonOptions<T>): IMutableSingleton<T>;
  createRegistry<TStore>(factory: (key: string) => TStore, disposer?: (store: TStore) => void): IStorageRegistry<TStore>;
}

export class DefaultStorageFactory implements IStorageFactory {
  constructor(private storageInstance: Storage = createDefaultStorageInstance()) {}
  public createCollection<T>(key: string, options?: StorageCollectionOptions<T>): IMutableCollection<T> {
    const keyExtractor = options?.keyExtractor || ((item: unknown) => String((item as Record<string, unknown>).id));
    const engine = options?.engine || new MapCollection<T>(keyExtractor);
    const logger = options?.logger || defaultLogger;
    const adapter = options?.adapter || new DefaultStorageAdapter<T[]>(options?.storageAdapter || this.storageInstance, logger, options?.serializer);
    return new StorageCollection<T>(key, { ...options, keyExtractor, engine, adapter, logger });
  }

  public createSingleton<T>(key: string, fallback: T, options?: StorageSingletonOptions<T>): IMutableSingleton<T> {
    const logger = options?.logger || defaultLogger;
    const adapter = options?.adapter || new DefaultStorageAdapter<T>(options?.storageAdapter || this.storageInstance, logger, options?.serializer);
    return new StorageSingleton<T>(key, fallback, { ...options, adapter, logger });
  }

  public createRegistry<TStore>(factory: (key: string) => TStore, disposer?: (store: TStore) => void): IStorageRegistry<TStore> {
    return new StorageRegistry<TStore>(factory, disposer);
  }
}

export const defaultStorageFactory = new DefaultStorageFactory();
