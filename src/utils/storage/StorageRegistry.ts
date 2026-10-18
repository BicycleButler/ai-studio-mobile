export class StorageRegistry<TStore> {
  private cache = new Map<string, TStore>();

  constructor(private factory: (key: string) => TStore) {}

  public get(key: string): TStore {
    if (!this.cache.has(key)) {
      this.cache.set(key, this.factory(key));
    }
    return this.cache.get(key)!;
  }

  public clear(): void {
    this.cache.clear();
  }

  public get keys(): string[] {
    return Array.from(this.cache.keys());
  }

  public get values(): TStore[] {
    return Array.from(this.cache.values());
  }
}
