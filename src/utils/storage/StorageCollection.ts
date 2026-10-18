import { StorageBase, StorageBaseOptions } from "./StorageBase";
import { safeGetStorageArray, safeSetStorage } from "./core";

export interface StorageCollectionOptions<T> {
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

export class StorageCollection<T> extends StorageBase<T[]> {
  private keyExtractor: (item: T) => string;
  private maxItems?: number;
  private onSave?: (items: T[]) => void;

  constructor(
    key: string,
    options?: StorageCollectionOptions<T>
  ) {
    const defaultGetter = (key: string, fallback: T[], storageInstance?: Storage) => {
      const raw = options?.getter ? options.getter(key, fallback) : safeGetStorageArray<T>(key, fallback, storageInstance);
      let filtered = raw;
      if (options?.validate) {
        filtered = raw.filter((item) => {
          try {
            return options.validate!(item);
          } catch (err) {
            console.warn(`StorageCollection[${key}]: validation error on item`, err);
            return false;
          }
        });
      }
      return filtered;
    };

    const arrayTransformIn = options?.transformIn
      ? (items: T[]) => items.map(options.transformIn!)
      : undefined;

    const arrayTransformOut = options?.transformOut
      ? (items: T[]) => {
          const result: T[] = [];
          for (const item of items) {
            try {
              result.push(options.transformOut!(item));
            } catch (err) {
              console.warn(`StorageCollection[${key}]: transformOut error on item`, err);
            }
          }
          return result;
        }
      : undefined;

    const arraySetter = (key: string, items: T[], storageInstance?: Storage) => {
       const success = options?.setter ? options.setter(key, items) : safeSetStorage(key, items, storageInstance);
       if (!success) {
           console.warn(`StorageCollection[${key}]: safeSetStorage returned false.`);
       }
    };

    const baseOptions: StorageBaseOptions<T[]> = {
      fallback: [],
      transformIn: arrayTransformIn,
      transformOut: arrayTransformOut,
      getter: defaultGetter,
      setter: arraySetter,
      storageAdapter: options?.storageAdapter,
    };

    super(key, baseOptions);

    this.keyExtractor = options?.keyExtractor || ((item: unknown) => String((item as Record<string, unknown>).id));
    this.maxItems = options?.maxItems;
    this.onSave = options?.onSave;
  }

  override save(itemsToSave: T[]): void {
    let items = itemsToSave;
    if (this.maxItems !== undefined && items.length > this.maxItems) {
      items = items.slice(0, this.maxItems);
    }
    super.save(items);
    if (this.onSave) {
      try {
        this.onSave(this.load());
      } catch (onSaveErr) {
        console.error(`StorageCollection[${this.key}]: error during onSave callback`, onSaveErr);
      }
    }
  }

  update(id: string, updates: Partial<T>): T | null {
    if (!id) return null;
    const items = this.load().map((item) => ({ ...item }));
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

  upsert(item: T, prepend = false): T {
    const items = this.load().map((i) => ({ ...i }));
    const id = this.keyExtractor(item);
    const index = items.findIndex((i) => this.keyExtractor(i) === id);

    const updated = {
      ...item,
      updatedAt: Date.now(),
    } as T;

    if (index >= 0) {
      items[index] = updated;
    } else {
      prepend ? items.unshift(updated) : items.push(updated);
    }

    this.save(items);
    return updated;
  }
}
