import { Observable } from "../observable";
import { StorageEngine, StorageEngineOptions } from "./StorageEngine";
import { IMutableSingleton } from "./types";
import { IDisposable } from "./StorageRegistry";

export class StorageSingleton<T> extends Observable<T> implements IMutableSingleton<T>, IDisposable {
  private engine: StorageEngine<T>;
  private unsubscribeEngine: () => void;

  constructor(
    key: string,
    fallback: T,
    options?: Omit<StorageEngineOptions<T>, 'fallback'>
  ) {
    super();
    this.engine = new StorageEngine(key, { ...options, fallback });
    this.unsubscribeEngine = this.engine.subscribe((state) => {
      this.notify(state);
    });
  }

  public getSnapshot(): T {
    return this.engine.getSnapshot();
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
    this.unsubscribeEngine();
    this.engine.dispose();
    this.clearListeners();
  }
}
