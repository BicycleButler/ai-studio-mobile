import { ArrayCollection } from "./ArrayCollection";
import { StorageBase, StorageBaseOptions } from "./StorageBase";
import { safeGetStorage, safeSetStorage } from "./core";
import { IMutableCollection } from "./types";

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

export class StorageCollection<T> extends StorageBase<T[]> implements IMutableCollection<T> {
  private arrayCollection: ArrayCollection<T>;
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
    this.arrayCollection = new ArrayCollection<T>(this.keyExtractor);
  }

  private applyOperation<R extends { items: T[]; changed: boolean }>(
    operation: (items: T[]) => R
  ): R {
    const result = operation(this.load());
    if (result.changed) {
      this.save(result.items);
    }
    return result;
  }

  update(id: string, updates: Partial<T>): T | null {
    if (!id) return null;
    return this.applyOperation((items) => this.arrayCollection.update(items, id, updates)).item || null;
  }

  bulkUpdate(updates: { id: string; changes: Partial<T> }[]): T[] {
    if (!updates || updates.length === 0) return this.load();
    this.applyOperation((items) => this.arrayCollection.bulkUpdate(items, updates));
    return this.load();
  }

  bulkDelete(ids: string[]): T[] {
    if (!ids || ids.length === 0) return this.load();
    this.applyOperation((items) => this.arrayCollection.bulkDelete(items, ids));
    return this.load();
  }

  delete(id: string): T[] {
    if (!id) return this.load();
    return this.bulkDelete([id]);
  }

  upsert(item: T, prepend = false): T {
    return this.applyOperation((items) => this.arrayCollection.upsert(items, item, prepend)).item as T;
  }

  bulkUpsert(newItems: T[], prepend = false): T[] {
    if (!newItems || newItems.length === 0) return this.load();
    this.applyOperation((items) => this.arrayCollection.bulkUpsert(items, newItems, prepend));
    return this.load();
  }
}
