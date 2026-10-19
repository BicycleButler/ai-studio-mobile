export interface IDisposable {
  dispose(): void;
}

export class StorageRegistry<TStore> {
  private cache = new Map<string, TStore>();
  private disposer?: (store: TStore) => void;

  constructor(private factory: (key: string) => TStore, disposer?: (store: TStore) => void) {
    this.disposer = disposer;
  }

  public get(key: string): TStore {
    if (!this.cache.has(key)) {
      this.cache.set(key, this.factory(key));
    }
    return this.cache.get(key)!;
  }

  public delete(key: string): boolean {
    const store = this.cache.get(key);
    if (store) {
      this.disposeStore(store);
      return this.cache.delete(key);
    }
    return false;
  }

  public clear(): void {
    for (const store of this.cache.values()) {
      this.disposeStore(store);
    }
    this.cache.clear();
  }

  private disposeStore(store: TStore): void {
    if (this.disposer) {
      this.disposer(store);
    } else if (store && typeof (store as { dispose?: () => void }).dispose === 'function') {
      (store as unknown as { dispose: () => void }).dispose();
    }
  }

  public get keys(): string[] {
    return Array.from(this.cache.keys());
  }

  public get values(): TStore[] {
    return Array.from(this.cache.values());
  }
}
