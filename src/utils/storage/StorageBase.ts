import { IReadableStore, Listener } from "../observable";
import { isBrowserEnvironment, getSafeWindow } from "../platform";
import { IDisposable } from "./StorageRegistry";
import { StorageEngine, StorageEngineOptions } from "./StorageEngine";

export type StorageBaseOptions<T> = StorageEngineOptions<T>;

export class StorageBase<T> implements IReadableStore<T>, IDisposable {
  protected engine: StorageEngine<T>;
  protected key: string;
  private boundHandleStorageEvent: (e: StorageEvent) => void;

  constructor(key: string, options: StorageBaseOptions<T>) {
    this.key = key;
    this.engine = new StorageEngine(key, options);
    this.boundHandleStorageEvent = this.handleStorageEvent.bind(this);

    if (isBrowserEnvironment()) {
      const win = getSafeWindow();
      if (win) {
        win.addEventListener("storage", this.boundHandleStorageEvent);
      }
    }
  }

  protected handleStorageEvent(e: StorageEvent): void {
    this.engine.handleStorageEvent(e);
  }

  public subscribe(listener: Listener<T>): () => void {
    return this.engine.subscribe(listener);
  }

  public getSnapshot(): T {
    return this.engine.load();
  }

  public load(): T {
    return this.engine.load();
  }

  public save(item: T): void {
    this.engine.save(item);
  }

  public clear(): void {
    this.engine.clear();
  }

  public dispose(): void {
    if (isBrowserEnvironment()) {
      const win = getSafeWindow();
      if (win) {
        win.removeEventListener("storage", this.boundHandleStorageEvent);
      }
    }
    this.engine.dispose();
  }
}
