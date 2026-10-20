import { deepFreeze } from "./helpers";
import { DefaultStorageAdapter } from "./core";
import { IStorageAdapter, IDisposable } from "./types";
import { Observable } from "../observable";
import { isBrowserEnvironment, getSafeWindow } from "../platform";

export interface StorageBaseOptions<T> {
  fallback: T;
  transformIn?: (item: T) => T;
  transformOut?: (item: T) => T;
  validate?: (item: unknown) => boolean;
  adapter?: IStorageAdapter<T>;
  storageAdapter?: Storage;
  onSave?: (items: T) => void;
}

export class StorageBase<T> extends Observable<T> implements IDisposable {
  protected key: string;
  protected options: StorageBaseOptions<T>;
  protected adapter: IStorageAdapter<T>;
  private boundHandleStorageEvent: (e: StorageEvent) => void;
  private cachedSnapshot: T | undefined = undefined;

  constructor(key: string, options: StorageBaseOptions<T>) {
    super();
    this.key = key;
    this.options = options;
    this.adapter = options.adapter || new DefaultStorageAdapter<T>(options.storageAdapter);

    this.boundHandleStorageEvent = this.handleStorageEvent.bind(this);

    if (isBrowserEnvironment()) {
      const win = getSafeWindow();
      if (win) {
        win.addEventListener("storage", this.boundHandleStorageEvent);
      }
    }
  }

  protected handleStorageEvent(e: StorageEvent): void {
    if (e.key === this.key || e.key === null) {
      this.invalidateCache();
      this.notify(this.load());
    }
  }

  private processRawValue(raw: T): T {
    let valid = raw;
    if (this.options.validate) {
      try {
        if (!this.options.validate(raw)) {
          return deepFreeze(this.options.fallback);
        }
      } catch (err) {
        console.warn(`StorageBase[${this.key}]: validation error`, err);
        return deepFreeze(this.options.fallback);
      }
    }

    let result = valid;
    if (this.options.transformOut) {
      try {
        result = this.options.transformOut(valid);
      } catch (err) {
        console.warn(`StorageBase[${this.key}]: transformOut error`, err);
        return deepFreeze(this.options.fallback);
      }
    }

    return deepFreeze(result);
  }

  protected invalidateCache(): void {
    this.cachedSnapshot = undefined;
  }

  public getSnapshot(): T {
    return this.load();
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
      console.error(`StorageBase[${this.key}]: unhandled load error`, err);
      const frozenFallback = deepFreeze(this.options.fallback);
      this.cachedSnapshot = frozenFallback;
      return frozenFallback;
    }
  }

  public save(item: T): void {
    let savedSnapshot: T;
    try {
      const toStore = this.options.transformIn ? this.options.transformIn(item) : item;
      this.adapter.set(this.key, toStore);
      // Write-through caching: bypass I/O round-trip
      // Simulate the serialization boundary to ensure proper data transformations
      let rawValueToCache: T;
      try {
          rawValueToCache = structuredClone(toStore);
      } catch {
          rawValueToCache = toStore; // Fallback if structuredClone fails but item is valid for storage
      }
      this.cachedSnapshot = this.processRawValue(rawValueToCache);
      savedSnapshot = this.cachedSnapshot;
    } catch (err) {
      console.warn(`StorageBase[${this.key}]: save error`, err);
      savedSnapshot = this.load(); // Return last known good state
    }

    this.notify(savedSnapshot);
    if (this.options.onSave) {
      try {
        this.options.onSave(savedSnapshot);
      } catch (onSaveErr) {
        console.error(`StorageBase[${this.key}]: error during onSave callback`, onSaveErr);
      }
    }
  }

  public clear(): void {
    this.adapter.remove(this.key);
    this.cachedSnapshot = undefined;
    const cleared = this.load();
    this.notify(cleared);
  }

  public dispose(): void {
    if (isBrowserEnvironment()) {
      const win = getSafeWindow();
      if (win) {
        win.removeEventListener("storage", this.boundHandleStorageEvent);
      }
    }
    this.clearListeners();
  }
}
