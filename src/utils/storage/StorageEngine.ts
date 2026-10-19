import { Observable, Listener } from "../observable";
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
  onSave?: (items: T) => void;
}

export class StorageEngine<T> {
  private key: string;
  private options: StorageEngineOptions<T>;
  private observable = new Observable<T>();
  private cachedSnapshot: T | undefined = undefined;

  constructor(key: string, options: StorageEngineOptions<T>) {
    this.key = key;
    this.options = {
      ...options,
      getter: options.getter || safeGetStorage,
      setter: options.setter || safeSetStorage,
    };
  }

  public subscribe(listener: Listener<T>): () => void {
    return this.observable.subscribe(listener);
  }

  public handleStorageEvent(e: StorageEvent): void {
    if (e.key === this.key || e.key === null) {
      this.cachedSnapshot = undefined;
      this.observable.notify(this.load());
    }
  }

  private processRawValue(raw: T): T {
    let valid = raw;
    if (this.options.validate) {
      try {
        if (!this.options.validate(raw)) {
          valid = this.options.fallback;
        }
      } catch (err) {
        console.warn(`StorageEngine[${this.key}]: validation error`, err);
        valid = this.options.fallback;
      }
    }

    let result = valid;
    if (this.options.transformOut) {
      try {
        result = this.options.transformOut(valid);
      } catch (err) {
        console.warn(`StorageEngine[${this.key}]: transformOut error`, err);
        result = this.options.fallback;
      }
    }

    return deepFreeze(result);
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

  public save(item: T): void {
    try {
      const toStore = this.options.transformIn ? this.options.transformIn(item) : item;
      const setter = this.options.setter!;
      setter(this.key, toStore, this.options.storageAdapter);
      this.cachedSnapshot = undefined;
      const loaded = this.load();
      this.observable.notify(loaded);
      if (this.options.onSave) {
        try {
          this.options.onSave(loaded);
        } catch (onSaveErr) {
          console.error(`StorageEngine[${this.key}]: error during onSave callback`, onSaveErr);
        }
      }
    } catch (err) {
      console.warn(`StorageEngine[${this.key}]: save error`, err);
    }
  }

  public clear(): void {
    safeRemoveStorage(this.key, this.options.storageAdapter);
    this.cachedSnapshot = undefined;
    this.observable.notify(this.load());
  }

  public dispose(): void {
    this.observable = new Observable<T>();
  }
}
