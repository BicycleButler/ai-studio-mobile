import { safeGetStorage, safeSetStorage, safeRemoveStorage } from "./storage/core";

export class StorageSingleton<T> {
  private key: string;
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
    this.key = key;
    this.fallback = fallback;
    this.transformIn = options?.transformIn;
    this.transformOut = options?.transformOut;
    this.validate = options?.validate;
    this.getter = options?.getter || (safeGetStorage as unknown as (key: string, fallback: T, storageInstance?: Storage) => T);
    this.setter = options?.setter || (safeSetStorage as unknown as (key: string, value: T, storageInstance?: Storage) => void);
    this.storageAdapter = options?.storageAdapter;
  }

  load(): T {
    const raw = this.getter(this.key, this.fallback, this.storageAdapter);
    let valid = raw;
    if (this.validate && !this.validate(raw)) {
      valid = this.fallback;
    }
    return this.transformOut ? this.transformOut(valid) : valid;
  }

  save(item: T): void {
    const toStore = this.transformIn ? this.transformIn(item) : item;
    this.setter(this.key, toStore, this.storageAdapter);
  }

  clear(): void {
    safeRemoveStorage(this.key, this.storageAdapter);
  }
}
