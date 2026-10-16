import { safeGetStorageArray, safeSetStorage } from "./storage/core";

export class StorageCollection<T extends { id: string }> {
  private key: string;
  private transformIn?: (item: T) => T;
  private transformOut?: (item: T) => T;
  private validate?: (item: unknown) => boolean;
  private maxItems?: number;
  private getter?: (key: string, fallback: T[]) => T[];
  private setter?: (key: string, value: T[]) => boolean;
  private onSave?: (items: T[]) => void;

  constructor(
    key: string,
    options?: {
      transformIn?: (item: T) => T;
      transformOut?: (item: T) => T;
      validate?: (item: unknown) => boolean;
      maxItems?: number;
      getter?: (key: string, fallback: T[]) => T[];
      setter?: (key: string, value: T[]) => boolean;
      onSave?: (items: T[]) => void;
    }
  ) {
    this.key = key;
    this.transformIn = options?.transformIn;
    this.transformOut = options?.transformOut;
    this.validate = options?.validate;
    this.maxItems = options?.maxItems;
    this.getter = options?.getter;
    this.setter = options?.setter;
    this.onSave = options?.onSave;
  }

  load(): T[] {
    const raw = this.getter ? this.getter(this.key, []) : safeGetStorageArray<T>(this.key, []);
    let filtered = raw;
    if (this.validate) {
      filtered = raw.filter((item) => this.validate!(item));
    }
    const result = this.transformOut ? filtered.map(this.transformOut) : filtered;
    return result;
  }

  save(itemsToSave: T[]): void {
    try {
      let items = itemsToSave;
      if (this.maxItems !== undefined && items.length > this.maxItems) {
        items = items.slice(0, this.maxItems);
      }
      const toStore = this.transformIn ? items.map(this.transformIn) : items;
      const success = this.setter ? this.setter(this.key, toStore) : safeSetStorage(this.key, toStore);
      if (!success) {
          console.warn(`StorageCollection[${this.key}]: safeSetStorage returned false.`);
      }
      if (this.onSave) {
        try {
            this.onSave(this.load());
        } catch (onSaveErr) {
            console.error(`StorageCollection[${this.key}]: error during onSave callback`, onSaveErr);
        }
      }
    } catch (err) {
      console.error(`StorageCollection[${this.key}]: unhandled error during save`, err);
    }
  }

  update(id: string, updates: Partial<Omit<T, "id">>): T | null {
    const items = this.load();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const updated = {
      ...items[index],
      ...updates,
      updatedAt: Date.now(),
    } as T;

    items[index] = updated;
    this.save(items);
    return updated;
  }

  bulkDelete(ids: string[]): T[] {
    if (!ids || ids.length === 0) return this.load();
    const items = this.load();
    const idSet = new Set(ids);
    const filtered = items.filter((item) => !idSet.has(item.id));
    if (filtered.length !== items.length) {
      this.save(filtered);
    }
    return filtered;
  }

  delete(id: string): T[] {
    const items = this.load();
    const filtered = items.filter((item) => item.id !== id);
    this.save(filtered);
    return filtered;
  }

  clear(): void {
    this.save([]);
  }

  upsert(item: T, prepend = false): T {
    let items = this.load();
    const index = items.findIndex((i) => i.id === item.id);

    const updated = {
      ...item,
      updatedAt: Date.now(),
    } as T;

    if (index >= 0) {
      items[index] = updated;
    } else {
      items = prepend ? [updated, ...items] : [...items, updated];
    }

    this.save(items);
    return updated;
  }
}
