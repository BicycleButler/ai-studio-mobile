import { StorageBase, StorageBaseOptions } from "./StorageBase";
import { IMutableSingleton } from "./types";
import { ISerializer } from "./serializer";

export interface StorageSingletonOptions<T> extends Omit<StorageBaseOptions<T>, 'fallback'> {
  serializer?: ISerializer;
}

export class StorageSingleton<T> extends StorageBase<T> implements IMutableSingleton<T> {
  constructor(
    key: string,
    fallback: T,
    options?: StorageSingletonOptions<T>
  ) {
    super(key, { ...options, fallback });
  }
}
