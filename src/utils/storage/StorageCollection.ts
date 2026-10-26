import { MapCollection } from "./MapCollection";
import { StorageBase, StorageBaseOptions } from "./StorageBase";
import { IMutableCollection, ICollectionEngine, IStorageAdapter } from "./types";
import { IEventEmitter } from "../eventEmitter";
import { ILogger, defaultLogger } from "../logger";

export interface StorageCollectionOptions<T> {
  engine?: ICollectionEngine<T>;
  keyExtractor?: (item: T) => string;
  transformIn?: (item: T) => T;
  transformOut?: (item: T) => T;
  validate?: (item: unknown) => boolean;
  maxItems?: number;
  adapter?: IStorageAdapter<T[]>;
  onSave?: (items: T[]) => void;
  storageAdapter?: Storage;
  storageEventObservable?: IEventEmitter<StorageEvent>;
  logger?: ILogger;
}

export class StorageCollection<T> extends StorageBase<T[]> implements IMutableCollection<T> {
  private collectionEngine: ICollectionEngine<T>;
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

    const logger = options?.logger || defaultLogger;
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
              logger.warn(`StorageCollection[${key}]: item transform/validate error`, err);
            }
          }
          return result;
        }
      : undefined;

    const baseOptions: StorageBaseOptions<T[]> = {
      adapter: options?.adapter,
      fallback: [],
      transformIn: arrayTransformIn,
      transformOut: arrayTransformOut,
      storageAdapter: options?.storageAdapter,
      onSave: options?.onSave,
      storageEventObservable: options?.storageEventObservable,
      logger: options?.logger,
    };

    super(key, baseOptions);

    this.keyExtractor = options?.keyExtractor || ((item: unknown) => String((item as Record<string, unknown>).id));
    this.collectionEngine = options?.engine || new MapCollection<T>(this.keyExtractor);
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
    return this.applyOperation((items) => this.collectionEngine.update(items, id, updates)).item || null;
  }

  bulkUpdate(updates: { id: string; changes: Partial<T> }[]): T[] {
    if (!updates || updates.length === 0) return this.load();
    this.applyOperation((items) => this.collectionEngine.bulkUpdate(items, updates));
    return this.load();
  }

  bulkDelete(ids: string[]): T[] {
    if (!ids || ids.length === 0) return this.load();
    this.applyOperation((items) => this.collectionEngine.bulkDelete(items, ids));
    return this.load();
  }

  delete(id: string): T[] {
    if (!id) return this.load();
    return this.applyOperation((items) => this.collectionEngine.delete(items, id)).items;
  }

  upsert(item: T, prepend = false): T {
    return this.applyOperation((items) => this.collectionEngine.upsert(items, item, prepend)).item as T;
  }

  bulkUpsert(newItems: T[], prepend = false): T[] {
    if (!newItems || newItems.length === 0) return this.load();
    this.applyOperation((items) => this.collectionEngine.bulkUpsert(items, newItems, prepend));
    return this.load();
  }
}
