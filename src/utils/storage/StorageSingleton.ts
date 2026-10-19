import { StorageBase, StorageBaseOptions } from "./StorageBase";
import { IMutableSingleton } from "./types";

export class StorageSingleton<T> extends StorageBase<T> implements IMutableSingleton<T> {
  constructor(
    key: string,
    fallback: T,
    options?: Omit<StorageBaseOptions<T>, 'fallback'>
  ) {
    super(key, { ...options, fallback });
  }
}
