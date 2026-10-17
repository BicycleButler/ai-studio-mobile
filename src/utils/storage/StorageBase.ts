import { Observable } from "../observable";
import { isBrowserEnvironment, getSafeWindow } from "../platform";

export abstract class StorageBase<T> extends Observable<T> {
  protected key: string;
  protected cachedSnapshot: T | undefined = undefined;
  protected storageAdapter?: Storage;
  private boundHandleStorageEvent: (e: StorageEvent) => void;

  constructor(key: string, storageAdapter?: Storage) {
    super();
    this.key = key;
    this.storageAdapter = storageAdapter;

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
      this.cachedSnapshot = undefined;
      this.notify(this.load());
    }
  }

  public bindSubscribe = (listener: () => void): () => void => {
    return this.subscribe(listener);
  };

  public getSnapshot = (): T => {
    return this.load();
  };

  public abstract load(): T;

  public dispose(): void {
    if (isBrowserEnvironment()) {
      const win = getSafeWindow();
      if (win) {
        win.removeEventListener("storage", this.boundHandleStorageEvent);
      }
    }
    this.listeners.clear();
  }
}
