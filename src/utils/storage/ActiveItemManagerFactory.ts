import { ActiveItemManager, IActiveItemManager } from "./ActiveItemManager";
import { StorageCollection, StorageCollectionOptions } from "./StorageCollection";
import { StorageSingleton, StorageSingletonOptions } from "./StorageSingleton";
import { IMutableCollection, IMutableSingleton } from "./types";

export interface CreateActiveItemManagerOptions<T> {
  collectionKey: string;
  collectionOptions?: StorageCollectionOptions<T>;
  collection?: IMutableCollection<T>;

  activeIdKey: string;
  activeIdOptions?: StorageSingletonOptions<string | null>;
  activeIdSingleton?: IMutableSingleton<string | null>;

  getId: (item: T) => string;
  allowImplicitSelection?: boolean;
}

export interface IActiveItemManagerFactory {
  create<T>(options: CreateActiveItemManagerOptions<T>): IActiveItemManager<T>;
}

export class DefaultActiveItemManagerFactory implements IActiveItemManagerFactory {
  public create<T>(options: CreateActiveItemManagerOptions<T>): IActiveItemManager<T> {
    const collection = options.collection || new StorageCollection<T>(options.collectionKey, options.collectionOptions);
    const activeIdSingleton = options.activeIdSingleton || new StorageSingleton<string | null>(options.activeIdKey, null, options.activeIdOptions);

    return new ActiveItemManager<T>({
      collection,
      activeIdSingleton,
      getId: options.getId,
      allowImplicitSelection: options.allowImplicitSelection,
    });
  }
}

export const defaultActiveItemManagerFactory = new DefaultActiveItemManagerFactory();

// Kept for backwards compatibility
export function createActiveItemManager<T>(options: CreateActiveItemManagerOptions<T>): IActiveItemManager<T> {
  return defaultActiveItemManagerFactory.create(options);
}
