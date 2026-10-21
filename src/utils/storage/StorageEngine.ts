export interface IStorageEngine<T> {
    load(): T;
    save(item: T): T;
    clear(): T;
    getSnapshot(): T;
    invalidateCache(): void;
}
