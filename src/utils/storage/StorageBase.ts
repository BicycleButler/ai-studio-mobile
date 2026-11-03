
import { IStorageAdapter, IStorageBase } from "./types";
import { Observable } from "../observable";
import { ILogger, defaultLogger } from "../logger";
import { deepFreeze } from "./helpers";
import { IEventEmitter } from "../eventEmitter";
import { ISerializer } from "./serializer";

export interface StorageBaseOptions<T> {
  fallback: T;
  transformIn?: (item: T) => T;
  transformOut?: (item: T) => T;
  validate?: (item: unknown) => boolean;
  adapter?: IStorageAdapter<T>;
  storageAdapter?: Storage;
  onSave?: (items: T) => void;
  storageEventObservable?: IEventEmitter<StorageEvent>;
  logger?: ILogger;
  serializer?: ISerializer;
}

export class StorageBase<T> extends Observable<T> implements IStorageBase<T> {
  protected key: string;
  protected options: StorageBaseOptions<T>;
  protected adapter: IStorageAdapter<T>;
  private boundHandleStorageEvent: (e: StorageEvent) => void;
  private globalUnsubscribe?: () => void;
  protected logger: ILogger;
  private cachedSnapshot: T | undefined = undefined;

  constructor(key: string, options: StorageBaseOptions<T>) {
    super(options.fallback);
    this.key = key;
    this.options = options;
    this.logger = options.logger || defaultLogger;
    if (!options.adapter) {
      throw new Error("IStorageAdapter is required for StorageBase");
    }
    this.adapter = options.adapter;

    this.boundHandleStorageEvent = this.handleStorageEvent.bind(this);

    const observableToUse = this.options.storageEventObservable;
    if (observableToUse) {
      this.globalUnsubscribe = observableToUse.subscribe(this.boundHandleStorageEvent);
    }
  }

  private processRawValue(raw: T): T {
    let valid = raw;
    if (this.options.validate) {
      try {
        if (!this.options.validate(raw)) {
          return deepFreeze(this.options.fallback);
        }
      } catch (err) {
        this.logger.warn(`StorageBase[${this.key}]: validation error`, err);
        return deepFreeze(this.options.fallback);
      }
    }

    let result = valid;
    if (this.options.transformOut) {
      try {
        result = this.options.transformOut(valid);
      } catch (err) {
        this.logger.warn(`StorageBase[${this.key}]: transformOut error`, err);
        return deepFreeze(this.options.fallback);
      }
    }

    return deepFreeze(result);
  }

  protected handleStorageEvent(e: StorageEvent): void {
    if (e.key === this.key || e.key === null) {
      this.cachedSnapshot = undefined;
      this.notify(this.load());
    }
  }

  public getSnapshot(): T {
    return this.load();
  }

  public load(): T {
    if (this.cachedSnapshot !== undefined) {
      return this.cachedSnapshot;
    }
    try {
      const raw = this.adapter.get(this.key, this.options.fallback);
      this.cachedSnapshot = this.processRawValue(raw);
      return this.cachedSnapshot;
    } catch (err) {
      this.logger.error(`StorageBase[${this.key}]: unhandled load error`, err);
      const frozenFallback = deepFreeze(this.options.fallback);
      this.cachedSnapshot = frozenFallback;
      return frozenFallback;
    }
  }

  public save(item: T): void {
    let savedSnapshot: T;
    try {
      const toStore = this.options.transformIn ? this.options.transformIn(item) : item;
      this.adapter.set(this.key, toStore);

      let rawValueToCache: T;
      try {
          rawValueToCache = structuredClone(toStore);
      } catch {
          try {
              const serialized = this.options.serializer
                  ? this.options.serializer.serialize(toStore)
                  : JSON.stringify(toStore);
              rawValueToCache = this.options.serializer
                  ? this.options.serializer.deserialize(serialized)
                  : JSON.parse(serialized);
          } catch {
              rawValueToCache = toStore;
          }
      }
      this.cachedSnapshot = this.processRawValue(rawValueToCache);
      savedSnapshot = this.cachedSnapshot;
    } catch (err) {
      this.logger.warn(`StorageBase[${this.key}]: save error`, err);
      savedSnapshot = this.load();
    }

    this.notify(savedSnapshot);
    if (this.options.onSave) {
      try {
        this.options.onSave(savedSnapshot);
      } catch (onSaveErr) {
        this.logger.error(`StorageBase[${this.key}]: error during onSave callback`, onSaveErr);
      }
    }
  }

  public clear(): void {
    this.adapter.remove(this.key);
    this.cachedSnapshot = undefined;
    const cleared = this.load();
    this.notify(cleared);
  }

  public dispose(): void {
    if (this.globalUnsubscribe) {
      this.globalUnsubscribe();
    }
    this.clearListeners();
  }
}
