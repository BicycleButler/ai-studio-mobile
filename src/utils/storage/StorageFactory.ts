import { IMutableCollection, IMutableSingleton } from "./types";
import { StorageCollection, StorageCollectionOptions } from "./StorageCollection";
import { StorageSingleton, StorageSingletonOptions } from "./StorageSingleton";
import { StorageRegistry, IStorageRegistry } from "./StorageRegistry";

export interface IStorageFactory {
  createCollection<T>(key: string, options?: StorageCollectionOptions<T>): IMutableCollection<T>;
  createSingleton<T>(key: string, fallback: T, options?: StorageSingletonOptions<T>): IMutableSingleton<T>;
  createRegistry<TStore>(factory: (key: string) => TStore, disposer?: (store: TStore) => void): IStorageRegistry<TStore>;
}

export class DefaultStorageFactory implements IStorageFactory {
  public createCollection<T>(key: string, options?: StorageCollectionOptions<T>): IMutableCollection<T> {
    return new StorageCollection<T>(key, options);
  }

  public createSingleton<T>(key: string, fallback: T, options?: StorageSingletonOptions<T>): IMutableSingleton<T> {
    return new StorageSingleton<T>(key, fallback, options);
  }

  public createRegistry<TStore>(factory: (key: string) => TStore, disposer?: (store: TStore) => void): IStorageRegistry<TStore> {
    return new StorageRegistry<TStore>(factory, disposer);
  }
}

export const defaultStorageFactory = new DefaultStorageFactory();
