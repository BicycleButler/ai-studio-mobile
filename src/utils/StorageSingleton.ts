import { safeGetStorage, safeSetStorage, safeRemoveStorage } from "./storage/core";
import { Observable } from "./observable";
import { isBrowserEnvironment, getSafeWindow } from "./platform";

export class StorageSingleton<T> extends Observable<T> {
  private key: string;
  private cachedSnapshot: T | null = null;
  private fallback: T;
  private transformIn?: (item: T) => T;
  private transformOut?: (item: T) => T;
  private validate?: (item: unknown) => boolean;
  private getter: (key: string, fallback: T, storageInstance?: Storage) => T;
  private setter: (key: string, value: T, storageInstance?: Storage) => void;
  private storageAdapter?: Storage;

  constructor(
    key: string,
    fallback: T,
    options?: {
      transformIn?: (item: T) => T;
      transformOut?: (item: T) => T;
      validate?: (item: unknown) => boolean;
      getter?: (key: string, fallback: T, storageInstance?: Storage) => T;
      setter?: (key: string, value: T, storageInstance?: Storage) => void;
      storageAdapter?: Storage;
    }
  ) {
    super();
    this.key = key;
    this.fallback = fallback;
    this.transformIn = options?.transformIn;
    this.transformOut = options?.transformOut;
    this.validate = options?.validate;
    this.getter = options?.getter || safeGetStorage;
    this.setter = options?.setter || safeSetStorage;
    this.storageAdapter = options?.storageAdapter;

    if (isBrowserEnvironment()) {
      const win = getSafeWindow();
      if (win) {
        win.addEventListener("storage", this.handleStorageEvent);
      }
    }
  }

  private handleStorageEvent = (e: StorageEvent) => {
    if (e.key === this.key || e.key === null) {
      this.cachedSnapshot = null;
      this.notify(this.load());
    }
  };

  public bindSubscribe = (listener: () => void) => {
    return this.subscribe(listener);
  };

  public getSnapshot = (): T => {
    return this.load();
  };

  load(): T {
    if (this.cachedSnapshot !== null) {
      return this.cachedSnapshot;
    }
    const raw = this.getter(this.key, this.fallback, this.storageAdapter);
    let valid = raw;
    if (this.validate && !this.validate(raw)) {
      valid = this.fallback;
    }
    const result = this.transformOut ? this.transformOut(valid) : valid;
    this.cachedSnapshot = result;
    return result;
  }

  save(item: T): void {
    try {
      const toStore = this.transformIn ? this.transformIn(item) : item;
      this.setter(this.key, toStore, this.storageAdapter);
      this.cachedSnapshot = null;
      this.notify(this.load());
    } catch (err) {
      console.warn(`StorageSingleton[${this.key}]: save error`, err);
    }
  }

  clear(): void {
    safeRemoveStorage(this.key, this.storageAdapter);
    this.cachedSnapshot = null;
    this.notify(this.load());
  }
}
