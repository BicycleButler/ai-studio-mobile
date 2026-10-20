import { StorageBase, StorageBaseOptions } from "./StorageBase";
import { IMutableSingleton } from "./types";

export interface StorageSingletonOptions<T> extends Omit<StorageBaseOptions<T>, 'fallback'> {
}

export class StorageSingleton<T> implements IMutableSingleton<T> {
  private baseStorage: StorageBase<T>;

  constructor(
    key: string,
    fallback: T,
    options?: StorageSingletonOptions<T>
  ) {
    this.baseStorage = new StorageBase<T>(key, { ...options, fallback });
  }

  public subscribe(listener: (state: T) => void): () => void {
    return this.baseStorage.subscribe(listener);
  }

  public getSnapshot(): T | undefined {
    return this.baseStorage.getSnapshot();
  }

  public load(): T {
    return this.baseStorage.load();
  }

  public save(item: T): void {
    this.baseStorage.save(item);
  }

  public clear(): void {
    this.baseStorage.clear();
  }

  public dispose(): void {
    this.baseStorage.dispose();
  }
}
