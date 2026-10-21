import { DefaultStorageAdapter, globalStorageEventObservable } from "./core";
import { IStorageAdapter, IDisposable } from "./types";
import { Observable, IObservable } from "../observable";
import { ILogger, defaultLogger } from "../logger";
import { IStorageEngine } from "./StorageEngine";
import { StorageEngineImpl } from "./StorageEngineImpl";

export interface StorageBaseOptions<T> {
  fallback: T;
  transformIn?: (item: T) => T;
  transformOut?: (item: T) => T;
  validate?: (item: unknown) => boolean;
  adapter?: IStorageAdapter<T>;
  storageAdapter?: Storage;
  onSave?: (items: T) => void;
  storageEventObservable?: IObservable<StorageEvent>;
  logger?: ILogger;
}

export class StorageBase<T> extends Observable<T> implements IDisposable {
  protected key: string;
  protected options: StorageBaseOptions<T>;
  protected adapter: IStorageAdapter<T>;
  private engine: IStorageEngine<T>;
  private boundHandleStorageEvent: (e: StorageEvent) => void;
  private globalUnsubscribe?: () => void;
  protected logger: ILogger;

  constructor(key: string, options: StorageBaseOptions<T>) {
    super();
    this.key = key;
    this.options = options;
    this.logger = options.logger || defaultLogger;
    this.adapter = options.adapter || new DefaultStorageAdapter<T>(options.storageAdapter, this.logger);

    this.engine = new StorageEngineImpl<T>(key, {
      fallback: options.fallback,
      transformIn: options.transformIn,
      transformOut: options.transformOut,
      validate: options.validate,
      adapter: this.adapter,
      logger: this.logger
    });

    this.boundHandleStorageEvent = this.handleStorageEvent.bind(this);

    const observableToUse = this.options.storageEventObservable || globalStorageEventObservable;
    this.globalUnsubscribe = observableToUse.subscribe(this.boundHandleStorageEvent);
  }

  protected handleStorageEvent(e: StorageEvent): void {
    if (e.key === this.key || e.key === null) {
      this.engine.invalidateCache();
      this.notify(this.load());
    }
  }

  public getSnapshot(): T {
    return this.engine.getSnapshot();
  }

  public load(): T {
    return this.engine.load();
  }

  public save(item: T): void {
    const savedSnapshot = this.engine.save(item);

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
    const cleared = this.engine.clear();
    this.notify(cleared);
  }

  public dispose(): void {
    if (this.globalUnsubscribe) {
      this.globalUnsubscribe();
    }
    this.clearListeners();
  }
}
