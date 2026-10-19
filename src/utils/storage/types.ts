import { IReadableStore } from "../observable";

export interface IDisposable {
  dispose(): void;
}

export interface CollectionOperationResult<T> {
  items: T[];
  changed: boolean;
  item?: T | null;
}

export interface ICollectionEngine<T> {
  update(items: T[], id: string, updates: Partial<T>): CollectionOperationResult<T>;
  bulkUpdate(items: T[], updates: { id: string; changes: Partial<T> }[]): CollectionOperationResult<T>;
  delete(items: T[], id: string): CollectionOperationResult<T>;
  bulkDelete(items: T[], ids: string[]): CollectionOperationResult<T>;
  upsert(items: T[], item: T, prepend?: boolean): CollectionOperationResult<T>;
  bulkUpsert(items: T[], newItems: T[], prepend?: boolean): CollectionOperationResult<T>;
}

export interface IMutableCollection<T> extends IReadableStore<T[]> {
  save: (items: T[]) => void;
  delete: (id: string) => T[];
  bulkDelete: (ids: string[]) => T[];
  upsert: (item: T, prepend?: boolean) => T;
  bulkUpsert: (newItems: T[], prepend?: boolean) => T[];
  update: (id: string, updates: Partial<T>) => T | null;
  bulkUpdate: (updates: { id: string; changes: Partial<T> }[]) => T[];
  load: () => T[];
}

export interface IMutableSingleton<T> extends IReadableStore<T> {
  save: (item: T) => void;
  clear: () => void;
  load: () => T;
}
