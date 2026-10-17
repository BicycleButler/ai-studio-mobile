import { safeGetStorage, safeSetStorage, safeRemoveStorage } from "./core";
import { StorageBase } from "./StorageBase";

export class StorageSingleton<T> extends StorageBase<T> {
  private fallback: T;
  private transformIn?: (item: T) => T;
  private transformOut?: (item: T) => T;
  private validate?: (item: unknown) => boolean;
  private getter: (key: string, fallback: T, storageInstance?: Storage) => T;
  private setter: (key: string, value: T, storageInstance?: Storage) => void;

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
    super(key, options?.storageAdapter);
    this.fallback = fallback;
    this.transformIn = options?.transformIn;
    this.transformOut = options?.transformOut;
    this.validate = options?.validate;
    this.getter = options?.getter || safeGetStorage;
    this.setter = options?.setter || safeSetStorage;
  }

  override load(): T {
    if (this.cachedSnapshot !== undefined) {
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
      this.cachedSnapshot = undefined;
      this.notify(this.load());
    } catch (err) {
      console.warn(`StorageSingleton[${this.key}]: save error`, err);
    }
  }

  clear(): void {
    safeRemoveStorage(this.key, this.storageAdapter);
    this.cachedSnapshot = undefined;
    this.notify(this.load());
  }
}
