import { StorageEngine, StorageEngineOptions } from "./StorageEngine";
import { Observable } from "../observable";
import { isBrowserEnvironment, getSafeWindow } from "../platform";
import { IMutableSingleton, IDisposable } from "./types";

export interface StorageSingletonOptions<T> extends Omit<StorageEngineOptions<T>, 'fallback'> {
  onSave?: (items: T) => void;
}

export class StorageSingleton<T> extends Observable<T> implements IMutableSingleton<T>, IDisposable {
  protected key: string;
  private engine: StorageEngine<T>;
  private boundHandleStorageEvent: (e: StorageEvent) => void;
  private onSave?: (items: T) => void;

  constructor(
    key: string,
    fallback: T,
    options?: StorageSingletonOptions<T>
  ) {
    super();
    this.key = key;
    this.engine = new StorageEngine(key, { ...options, fallback });
    this.onSave = options?.onSave;

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
      this.engine.invalidateCache();
      this.notify(this.load());
    }
  }

  public getSnapshot(): T {
    return this.load();
  }

  public load(): T {
    return this.engine.load();
  }

  public save(item: T): void {
    const saved = this.engine.save(item);
    this.notify(saved);
    if (this.onSave) {
      try {
        this.onSave(saved);
      } catch (onSaveErr) {
        console.error(`StorageSingleton[${this.key}]: error during onSave callback`, onSaveErr);
      }
    }
  }

  public clear(): void {
    const cleared = this.engine.clear();
    this.notify(cleared);
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
