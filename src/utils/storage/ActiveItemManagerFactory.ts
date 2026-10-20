import { ActiveItemManager } from "./ActiveItemManager";
import { StorageCollection, StorageCollectionOptions } from "./StorageCollection";
import { StorageSingleton, StorageSingletonOptions } from "./StorageSingleton";

export interface CreateActiveItemManagerOptions<T> {
  collectionKey: string;
  collectionOptions?: StorageCollectionOptions<T>;

  activeIdKey: string;
  activeIdOptions?: StorageSingletonOptions<string | null>;

  getId: (item: T) => string;
  onActiveItemChange?: (activeItem: T | null) => void;
  allowImplicitSelection?: boolean;
}

export function createActiveItemManager<T>(options: CreateActiveItemManagerOptions<T>): ActiveItemManager<T> {
  const collection = new StorageCollection<T>(options.collectionKey, options.collectionOptions);
  const activeIdSingleton = new StorageSingleton<string | null>(options.activeIdKey, null, options.activeIdOptions);

  return new ActiveItemManager<T>({
    collection,
    activeIdSingleton,
    getId: options.getId,
    onActiveItemChange: options.onActiveItemChange,
    allowImplicitSelection: options.allowImplicitSelection,
  });
}
