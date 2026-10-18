import { Observable, IReadableStore, Listener } from "../observable";
import { isBrowserEnvironment, getSafeWindow } from "../platform";
import { deepFreeze } from "./helpers";
import { safeGetStorage, safeSetStorage, safeRemoveStorage } from "./core";

export interface StorageBaseOptions<T> {
  fallback: T;
  transformIn?: (item: T) => T;
  transformOut?: (item: T) => T;
  validate?: (item: unknown) => boolean;
  getter?: (key: string, fallback: T, storageInstance?: Storage) => T;
  setter?: (key: string, value: T, storageInstance?: Storage) => void;
  storageAdapter?: Storage;
}

export class StorageBase<T> implements IReadableStore<T> {
  protected observable = new Observable<T>();
  protected key: string;
  protected cachedSnapshot: T | undefined = undefined;
  protected storageAdapter?: Storage;
  private boundHandleStorageEvent: (e: StorageEvent) => void;

  protected fallback: T;
  protected transformIn?: (item: T) => T;
  protected transformOut?: (item: T) => T;
  protected validate?: (item: unknown) => boolean;
  protected getter: (key: string, fallback: T, storageInstance?: Storage) => T;
  protected setter: (key: string, value: T, storageInstance?: Storage) => void;

  constructor(key: string, options: StorageBaseOptions<T>) {
    this.key = key;
    this.storageAdapter = options.storageAdapter;

    this.fallback = options.fallback;
    this.transformIn = options.transformIn;
    this.transformOut = options.transformOut;
    this.validate = options.validate;
    this.getter = options.getter || safeGetStorage;
    this.setter = options.setter || safeSetStorage;

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
      this.cachedSnapshot = undefined;
      this.observable.notify(this.load());
    }
  }

  public subscribe(listener: Listener<T>): () => void {
    return this.observable.subscribe(listener);
  }

  public getSnapshot(): T {
    return this.load();
  }

  public load(): T {
    if (this.cachedSnapshot !== undefined) {
      return this.cachedSnapshot;
    }
    try {
      const raw = this.getter(this.key, this.fallback, this.storageAdapter);
      let valid = raw;
      if (this.validate) {
        try {
          if (!this.validate(raw)) {
            valid = this.fallback;
          }
        } catch (err) {
          console.warn(`StorageBase[${this.key}]: validation error`, err);
          valid = this.fallback;
        }
      }

      let result = valid;
      if (this.transformOut) {
        try {
          result = this.transformOut(valid);
        } catch (err) {
          console.warn(`StorageBase[${this.key}]: transformOut error`, err);
          result = this.fallback;
        }
      }

      const frozenResult = deepFreeze(result);
      this.cachedSnapshot = frozenResult;
      return frozenResult;
    } catch (err) {
      console.error(`StorageBase[${this.key}]: unhandled load error`, err);
      const frozenFallback = deepFreeze(this.fallback);
      this.cachedSnapshot = frozenFallback;
      return frozenFallback;
    }
  }

  public save(item: T): void {
    try {
      const toStore = this.transformIn ? this.transformIn(item) : item;
      this.setter(this.key, toStore, this.storageAdapter);
      this.cachedSnapshot = undefined;
      this.observable.notify(this.load());
    } catch (err) {
      console.warn(`StorageBase[${this.key}]: save error`, err);
    }
  }

  public clear(): void {
    safeRemoveStorage(this.key, this.storageAdapter);
    this.cachedSnapshot = undefined;
    this.observable.notify(this.load());
  }

  public dispose(): void {
    if (isBrowserEnvironment()) {
      const win = getSafeWindow();
      if (win) {
        win.removeEventListener("storage", this.boundHandleStorageEvent);
      }
    }
    // Note: since observable encapsulates listeners, we recreate it to clear them.
    // Alternatively, we could add a `clear` method to Observable if we needed to retain the instance.
    this.observable = new Observable<T>();
  }
}
