import { deepFreeze } from "./helpers";
import { safeGetStorage, safeSetStorage, safeRemoveStorage } from "./core";

export interface StorageEngineOptions<T> {
  fallback: T;
  transformIn?: (item: T) => T;
  transformOut?: (item: T) => T;
  validate?: (item: unknown) => boolean;
  getter?: (key: string, fallback: T, storageInstance?: Storage) => T;
  setter?: (key: string, value: T, storageInstance?: Storage) => void;
  storageAdapter?: Storage;
}

export class StorageEngine<T> {
  private key: string;
  private options: StorageEngineOptions<T>;
  private cachedSnapshot: T | undefined = undefined;

  constructor(key: string, options: StorageEngineOptions<T>) {
    this.key = key;
    this.options = {
      ...options,
      getter: options.getter || safeGetStorage,
      setter: options.setter || safeSetStorage,
    };
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
      const getter = this.options.getter!;
      const raw = getter(this.key, this.options.fallback, this.options.storageAdapter);
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
      const setter = this.options.setter!;
      setter(this.key, toStore, this.options.storageAdapter);
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
    safeRemoveStorage(this.key, this.options.storageAdapter);
    this.cachedSnapshot = undefined;
    return this.load();
  }
}
