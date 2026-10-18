import { StorageBase, StorageBaseOptions } from "./StorageBase";

export class StorageSingleton<T> extends StorageBase<T> {
  constructor(
    key: string,
    fallback: T,
    options?: Omit<StorageBaseOptions<T>, 'fallback'>
  ) {
    super(key, { ...options, fallback });
  }
}
