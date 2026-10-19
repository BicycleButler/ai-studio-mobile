import { StorageBase, StorageBaseOptions } from "./StorageBase";
import { IMutableSingleton } from "./types";
import { IDisposable } from "./StorageRegistry";

export class StorageSingleton<T> extends StorageBase<T> implements IMutableSingleton<T>, IDisposable {
  constructor(
    key: string,
    fallback: T,
    options?: Omit<StorageBaseOptions<T>, 'fallback'>
  ) {
    super(key, { ...options, fallback });
  }
}
