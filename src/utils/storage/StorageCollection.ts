import { StorageBase, StorageBaseOptions } from "./StorageBase";
import { safeGetStorage, safeSetStorage } from "./core";

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

  constructor(
    key: string,
    options?: StorageCollectionOptions<T>
  ) {
    const arrayTransformIn = (items: T[]) => {
      let processed = options?.transformIn ? items.map(options.transformIn) : items;
      if (options?.maxItems !== undefined && processed.length > options.maxItems) {
        processed = processed.slice(0, options.maxItems);
      }
      return processed;
    };

    const arrayTransformOut = (options?.transformOut || options?.validate)
      ? (items: T[]) => {
          const result: T[] = [];
          for (const item of items) {
            try {
              if (options?.validate && !options.validate(item)) {
                continue;
              }
              result.push(options?.transformOut ? options.transformOut(item) : item);
            } catch (err) {
              console.warn(`StorageCollection[${key}]: item transform/validate error`, err);
            }
          }
          return result;
        }
      : undefined;

    const baseOptions: StorageBaseOptions<T[]> = {
      fallback: [],
      transformIn: arrayTransformIn,
      transformOut: arrayTransformOut,
      getter: options?.getter || (safeGetStorage as unknown as (key: string, fallback: T[], storageInstance?: Storage) => T[]),
      setter: options?.setter || safeSetStorage,
      storageAdapter: options?.storageAdapter,
      onSave: options?.onSave,
    };

    super(key, baseOptions);

    this.keyExtractor = options?.keyExtractor || ((item: unknown) => String((item as Record<string, unknown>).id));
  }

  /**
   * Internal helper to apply a mutation function to the collection.
   * Reduces duplication of `this.load()` and `this.save()` calls.
   */
  private mutate(mutator: (items: T[]) => boolean): T[] {
    const items = this.load().map(item => ({ ...item }));
    const shouldSave = mutator(items);
    if (shouldSave) {
      this.save(items);
    }
    return this.load();
  }

  update(id: string, updates: Partial<T>): T | null {
    if (!id) return null;
    let updatedItem: T | null = null;
    this.mutate((items) => {
      const index = items.findIndex((item) => this.keyExtractor(item) === id);
      if (index === -1) return false;
      updatedItem = { ...items[index], ...updates } as T;
      items[index] = updatedItem;
      return true;
    });
    return updatedItem;
  }

  bulkUpdate(updates: { id: string; changes: Partial<T> }[]): T[] {
    if (!updates || updates.length === 0) return this.load();
    return this.mutate((items) => {
      let changed = false;
      const updatesMap = new Map<string, Partial<T>>();
      for (const update of updates) {
        updatesMap.set(update.id, update.changes);
      }
      for (let i = 0; i < items.length; i++) {
        const id = this.keyExtractor(items[i]);
        const changes = updatesMap.get(id);
        if (changes !== undefined) {
          items[i] = { ...items[i], ...changes } as T;
          changed = true;
        }
      }
      return changed;
    });
  }

  bulkDelete(ids: string[]): T[] {
    if (!ids || ids.length === 0) return this.load();
    const idSet = new Set(ids);
    return this.mutate((items) => {
      const originalLength = items.length;
      const filtered = items.filter((item) => !idSet.has(this.keyExtractor(item)));
      if (filtered.length !== originalLength) {
        // Use array splice instead of reassigning length and push for better robustness
        items.splice(0, items.length, ...filtered);
        return true;
      }
      return false;
    });
  }

  delete(id: string): T[] {
    if (!id) return this.load();
    return this.bulkDelete([id]);
  }

  upsert(item: T, prepend = false): T {
    let updatedItem: T | null = null;
    this.mutate((items) => {
      const id = this.keyExtractor(item);
      const index = items.findIndex((i) => this.keyExtractor(i) === id);
      updatedItem = { ...item } as T;

      if (index >= 0) {
        items[index] = updatedItem;
      } else {
        prepend ? items.unshift(updatedItem) : items.push(updatedItem);
      }
      return true;
    });
    return updatedItem!;
  }

  bulkUpsert(newItems: T[], prepend = false): T[] {
    if (!newItems || newItems.length === 0) return this.load();
    return this.mutate((items) => {
      const indexMap = new Map<string, number>();
      for (let i = 0; i < items.length; i++) {
        indexMap.set(this.keyExtractor(items[i]), i);
      }

      for (const item of newItems) {
        const id = this.keyExtractor(item);
        const index = indexMap.get(id);
        const updatedItem = { ...item } as T;

        if (index !== undefined) {
          items[index] = updatedItem;
        } else {
          if (prepend) {
            items.unshift(updatedItem);
            // Rebuild index map if prepending, as indices shift
            indexMap.clear();
            for (let i = 0; i < items.length; i++) {
              indexMap.set(this.keyExtractor(items[i]), i);
            }
          } else {
            items.push(updatedItem);
            indexMap.set(id, items.length - 1);
          }
        }
      }
      return true;
    });
  }
}
