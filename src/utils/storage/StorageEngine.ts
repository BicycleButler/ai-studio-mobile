import { deepFreeze } from "./helpers";
import { DefaultStorageAdapter } from "./core";
import { IStorageAdapter } from "./types";

export interface StorageEngineOptions<T> {
  fallback: T;
  transformIn?: (item: T) => T;
  transformOut?: (item: T) => T;
  validate?: (item: unknown) => boolean;
  adapter?: IStorageAdapter<T>;
  storageAdapter?: Storage;
}

export class StorageEngine<T> {
  private key: string;
  private options: StorageEngineOptions<T>;
  private adapter: IStorageAdapter<T>;
  private cachedSnapshot: T | undefined = undefined;

  constructor(key: string, options: StorageEngineOptions<T>) {
    this.key = key;
    this.options = options;
    this.adapter = options.adapter || new DefaultStorageAdapter<T>(options.storageAdapter);
  }

  private processRawValue(raw: T): T {
    let valid = raw;
    if (this.options.validate) {
      try {
        if (!this.options.validate(raw)) {
          return deepFreeze(this.options.fallback);
        }
      } catch (err) {
        console.warn(`StorageEngine[${this.key}]: validation error`, err);
        return deepFreeze(this.options.fallback);
      }
    }

    let result = valid;
    if (this.options.transformOut) {
      try {
        result = this.options.transformOut(valid);
      } catch (err) {
        console.warn(`StorageEngine[${this.key}]: transformOut error`, err);
        return deepFreeze(this.options.fallback);
      }
    }

    return deepFreeze(result);
  }

  public invalidateCache(): void {
    this.cachedSnapshot = undefined;
  }

  public load(): T {
    if (this.cachedSnapshot !== undefined) {
      return this.cachedSnapshot;
    }
    try {
      const raw = this.adapter.get(this.key, this.options.fallback);
      this.cachedSnapshot = this.processRawValue(raw);
      return this.cachedSnapshot;
    } catch (err) {
      console.error(`StorageEngine[${this.key}]: unhandled load error`, err);
      const frozenFallback = deepFreeze(this.options.fallback);
      this.cachedSnapshot = frozenFallback;
      return frozenFallback;
    }
  }

  public save(item: T): T {
    try {
      const toStore = this.options.transformIn ? this.options.transformIn(item) : item;
      this.adapter.set(this.key, toStore);
      // Write-through caching: bypass I/O round-trip
      // Simulate the serialization boundary to ensure proper data transformations
      let rawValueToCache: T;
      try {
          const serialized = JSON.stringify(toStore);
          rawValueToCache = JSON.parse(serialized);
      } catch {
          rawValueToCache = toStore; // Fallback if stringify fails but item is valid for storage
      }
      this.cachedSnapshot = this.processRawValue(rawValueToCache);
      return this.cachedSnapshot;
    } catch (err) {
      console.warn(`StorageEngine[${this.key}]: save error`, err);
      return this.load(); // Return last known good state
    }
  }

  public clear(): T {
    this.adapter.remove(this.key);
    this.cachedSnapshot = undefined;
    return this.load();
  }
}
