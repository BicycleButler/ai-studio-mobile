import { IStorageEngine } from "./StorageEngine";
import { deepFreeze } from "./helpers";
import { IStorageAdapter } from "./types";
import { ILogger, defaultLogger } from "../logger";

export interface StorageEngineOptions<T> {
  fallback: T;
  transformIn?: (item: T) => T;
  transformOut?: (item: T) => T;
  validate?: (item: unknown) => boolean;
  adapter: IStorageAdapter<T>;
  logger?: ILogger;
}

export class StorageEngineImpl<T> implements IStorageEngine<T> {
  protected key: string;
  protected options: StorageEngineOptions<T>;
  private cachedSnapshot: T | undefined = undefined;
  protected logger: ILogger;

  constructor(key: string, options: StorageEngineOptions<T>) {
    this.key = key;
    this.options = options;
    this.logger = options.logger || defaultLogger;
  }

  private processRawValue(raw: T): T {
    let valid = raw;
    if (this.options.validate) {
      try {
        if (!this.options.validate(raw)) {
          return deepFreeze(this.options.fallback);
        }
      } catch (err) {
        this.logger.warn(`StorageEngineImpl[${this.key}]: validation error`, err);
        return deepFreeze(this.options.fallback);
      }
    }

    let result = valid;
    if (this.options.transformOut) {
      try {
        result = this.options.transformOut(valid);
      } catch (err) {
        this.logger.warn(`StorageEngineImpl[${this.key}]: transformOut error`, err);
        return deepFreeze(this.options.fallback);
      }
    }

    return deepFreeze(result);
  }

  public invalidateCache(): void {
    this.cachedSnapshot = undefined;
  }

  public getSnapshot(): T {
    return this.load();
  }

  public load(): T {
    if (this.cachedSnapshot !== undefined) {
      return this.cachedSnapshot;
    }
    try {
      const raw = this.options.adapter.get(this.key, this.options.fallback);
      this.cachedSnapshot = this.processRawValue(raw);
      return this.cachedSnapshot;
    } catch (err) {
      this.logger.error(`StorageEngineImpl[${this.key}]: unhandled load error`, err);
      const frozenFallback = deepFreeze(this.options.fallback);
      this.cachedSnapshot = frozenFallback;
      return frozenFallback;
    }
  }

  public save(item: T): T {
    let savedSnapshot: T;
    try {
      const toStore = this.options.transformIn ? this.options.transformIn(item) : item;
      this.options.adapter.set(this.key, toStore);

      let rawValueToCache: T;
      try {
          rawValueToCache = structuredClone(toStore);
      } catch {
          rawValueToCache = toStore;
      }
      this.cachedSnapshot = this.processRawValue(rawValueToCache);
      savedSnapshot = this.cachedSnapshot;
    } catch (err) {
      this.logger.warn(`StorageEngineImpl[${this.key}]: save error`, err);
      savedSnapshot = this.load();
    }

    return savedSnapshot;
  }

  public clear(): T {
    this.options.adapter.remove(this.key);
    this.cachedSnapshot = undefined;
    return this.load();
  }
}
