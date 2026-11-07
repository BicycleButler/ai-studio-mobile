import { ActiveItemManager, IActiveItemManager } from "./ActiveItemManager";
import { StorageCollectionOptions } from "./StorageCollection";
import { DefaultStorageFactory, IStorageFactory } from "./StorageFactory";
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
  implicitSelectionStrategy?: ISelectionStrategy<T>;
}

export interface IActiveItemManagerFactory {
  create<T>(options: CreateActiveItemManagerOptions<T>): IActiveItemManager<T>;
}

export class DefaultActiveItemManagerFactory implements IActiveItemManagerFactory {
  public create<T>(options: CreateActiveItemManagerOptions<T>): IActiveItemManager<T> {
    const factory = options.storageFactory || new DefaultStorageFactory();
    const collection = options.collection || factory.createCollection<T>(options.collectionKey, options.collectionOptions);
    const activeIdSingleton = options.activeIdSingleton || factory.createSingleton<string | null>(options.activeIdKey, null, options.activeIdOptions);

    let implicitSelectionStrategy = options.implicitSelectionStrategy;

    if (!implicitSelectionStrategy) {
        implicitSelectionStrategy = new FirstItemSelectionStrategy<T>();
    }

    return new ActiveItemManager<T>({
      collection,
      activeIdSingleton,
      getId: options.getId,
      implicitSelectionStrategy,
    });
  }
}



