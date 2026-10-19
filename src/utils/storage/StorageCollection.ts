import { ArrayCollection } from "./ArrayCollection";
import { StorageEngine, StorageEngineOptions } from "./StorageEngine";
import { Observable } from "../observable";
import { isBrowserEnvironment, getSafeWindow } from "../platform";

import { IMutableCollection, IDisposable, ICollectionEngine, IStorageAdapter } from "./types";

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
}

export class StorageCollection<T> extends Observable<T[]> implements IMutableCollection<T>, IDisposable {
  protected key: string;
  private storageEngine: StorageEngine<T[]>;
  private collectionEngine: ICollectionEngine<T>;
  private keyExtractor: (item: T) => string;
  private boundHandleStorageEvent: (e: StorageEvent) => void;
  private onSave?: (items: T[]) => void;

  constructor(
    key: string,
    options?: StorageCollectionOptions<T>
  ) {
    super();
    this.key = key;

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

    const engineOptions: StorageEngineOptions<T[]> = {
      adapter: options?.adapter,
      fallback: [],
      transformIn: arrayTransformIn,
      transformOut: arrayTransformOut,
                  storageAdapter: options?.storageAdapter,
    };

    this.storageEngine = new StorageEngine(key, engineOptions);
    this.onSave = options?.onSave;

    this.keyExtractor = options?.keyExtractor || ((item: unknown) => String((item as Record<string, unknown>).id));
    this.collectionEngine = options?.engine || new ArrayCollection<T>(this.keyExtractor);

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
      this.storageEngine.invalidateCache();
      this.notify(this.load());
    }
  }

  public getSnapshot(): T[] {
    return this.load();
  }

  public load(): T[] {
    return this.storageEngine.load();
  }

  public save(items: T[]): void {
    const saved = this.storageEngine.save(items);
    this.notify(saved);
    if (this.onSave) {
      try {
        this.onSave(saved);
      } catch (onSaveErr) {
        console.error(`StorageCollection[${this.key}]: error during onSave callback`, onSaveErr);
      }
    }
  }

  public clear(): void {
    const cleared = this.storageEngine.clear();
    this.notify(cleared);
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

  public dispose(): void {
    if (isBrowserEnvironment()) {
      const win = getSafeWindow();
      if (win) {
        win.removeEventListener("storage", this.boundHandleStorageEvent);
      }
    }
    this.clearListeners();
  }
}
