import { ActiveItemManager, IActiveItemManager } from "./ActiveItemManager";
import { StorageCollectionOptions } from "./StorageCollection";
import { defaultStorageFactory, IStorageFactory } from "./StorageFactory";
import { StorageSingletonOptions } from "./StorageSingleton";
import { IMutableCollection, IMutableSingleton } from "./types";
import { ISelectionStrategy, FirstItemSelectionStrategy, NoImplicitSelectionStrategy } from "./selectionStrategy";

export interface CreateActiveItemManagerOptions<T> {
  storageFactory?: IStorageFactory;
  collectionKey: string;
  collectionOptions?: StorageCollectionOptions<T>;
  collection?: IMutableCollection<T>;

  activeIdKey: string;
  activeIdOptions?: StorageSingletonOptions<string | null>;
  activeIdSingleton?: IMutableSingleton<string | null>;

  getId: (item: T) => string;
  allowImplicitSelection?: boolean; // Deprecated, use implicitSelectionStrategy
  implicitSelectionStrategy?: ISelectionStrategy<T>;
}

export interface IActiveItemManagerFactory {
  create<T>(options: CreateActiveItemManagerOptions<T>): IActiveItemManager<T>;
}

export class DefaultActiveItemManagerFactory implements IActiveItemManagerFactory {
  public create<T>(options: CreateActiveItemManagerOptions<T>): IActiveItemManager<T> {
    const factory = options.storageFactory || defaultStorageFactory;
    const collection = options.collection || factory.createCollection<T>(options.collectionKey, options.collectionOptions);
    const activeIdSingleton = options.activeIdSingleton || factory.createSingleton<string | null>(options.activeIdKey, null, options.activeIdOptions);

    let implicitSelectionStrategy = options.implicitSelectionStrategy;

    if (!implicitSelectionStrategy) {
        if (options.allowImplicitSelection === false) {
             implicitSelectionStrategy = new NoImplicitSelectionStrategy<T>();
        } else {
             implicitSelectionStrategy = new FirstItemSelectionStrategy<T>();
        }
    }

    return new ActiveItemManager<T>({
      collection,
      activeIdSingleton,
      getId: options.getId,
      allowImplicitSelection: options.allowImplicitSelection,
      implicitSelectionStrategy,
    });
  }
}

export const defaultActiveItemManagerFactory = new DefaultActiveItemManagerFactory();

// Kept for backwards compatibility
export function createActiveItemManager<T>(options: CreateActiveItemManagerOptions<T>): IActiveItemManager<T> {
  return defaultActiveItemManagerFactory.create(options);
}
