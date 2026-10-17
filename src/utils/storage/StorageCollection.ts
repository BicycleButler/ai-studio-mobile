import { safeGetStorageArray, safeSetStorage } from "./core";
import { StorageBase } from "./StorageBase";

export class StorageCollection<T> extends StorageBase<T[]> {
  private keyExtractor: (item: T) => string;
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
      keyExtractor?: (item: T) => string;
      transformIn?: (item: T) => T;
      transformOut?: (item: T) => T;
      validate?: (item: unknown) => boolean;
      maxItems?: number;
      getter?: (key: string, fallback: T[]) => T[];
      setter?: (key: string, value: T[]) => boolean;
      onSave?: (items: T[]) => void;
      storageAdapter?: Storage;
    }
  ) {
    super(key, options?.storageAdapter);
    // Default to extracting an 'id' property if it exists
    this.keyExtractor = options?.keyExtractor || ((item: unknown) => String((item as Record<string, unknown>).id));
    this.transformIn = options?.transformIn;
    this.transformOut = options?.transformOut;
    this.validate = options?.validate;
    this.maxItems = options?.maxItems;
    this.getter = options?.getter;
    this.setter = options?.setter;
    this.onSave = options?.onSave;
  }

  override load(): T[] {
    if (this.cachedSnapshot !== undefined) {
      return this.cachedSnapshot;
    }
    try {
      const raw = this.getter ? this.getter(this.key, []) : safeGetStorageArray<T>(this.key, [], this.storageAdapter);
      let filtered = raw;
      if (this.validate) {
        filtered = raw.filter((item) => {
          try {
            return this.validate!(item);
          } catch (err) {
            console.warn(`StorageCollection[${this.key}]: validation error on item`, err);
            return false; // Skip invalid item
          }
        });
      }

      let result: T[] = [];
      if (this.transformOut) {
        // Only map elements that successfully transform without throwing
        for (const item of filtered) {
          try {
            result.push(this.transformOut(item));
          } catch (err) {
            console.warn(`StorageCollection[${this.key}]: transformOut error on item`, err);
          }
        }
      } else {
        result = filtered;
      }

      this.cachedSnapshot = result;
      return result;
    } catch (err) {
      console.error(`StorageCollection[${this.key}]: unhandled error during load`, err);
      return [];
    }
  }

  save(itemsToSave: T[]): void {
    try {
      let items = itemsToSave;
      if (this.maxItems !== undefined && items.length > this.maxItems) {
        items = items.slice(0, this.maxItems);
      }
      const toStore = this.transformIn ? items.map(this.transformIn) : items;
      const success = this.setter ? this.setter(this.key, toStore) : safeSetStorage(this.key, toStore, this.storageAdapter);
      if (!success) {
          console.warn(`StorageCollection[${this.key}]: safeSetStorage returned false.`);
      }
      this.cachedSnapshot = undefined;
      const loaded = this.load();
      this.notify(loaded);

      if (this.onSave) {
        try {
            this.onSave(loaded);
        } catch (onSaveErr) {
            console.error(`StorageCollection[${this.key}]: error during onSave callback`, onSaveErr);
        }
      }
    } catch (err) {
      console.error(`StorageCollection[${this.key}]: unhandled error during save`, err);
    }
  }

  update(id: string, updates: Partial<T>): T | null {
    if (!id) return null;
    const items = this.load();
    const index = items.findIndex((item) => this.keyExtractor(item) === id);
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
    const filtered = items.filter((item) => !idSet.has(this.keyExtractor(item)));
    if (filtered.length !== items.length) {
      this.save(filtered);
    }
    return filtered;
  }

  delete(id: string): T[] {
    if (!id) return this.load();
    const items = this.load();
    const filtered = items.filter((item) => this.keyExtractor(item) !== id);
    this.save(filtered);
    return filtered;
  }

  clear(): void {
    this.save([]);
  }

  upsert(item: T, prepend = false): T {
    let items = this.load();
    const id = this.keyExtractor(item);
    const index = items.findIndex((i) => this.keyExtractor(i) === id);

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
