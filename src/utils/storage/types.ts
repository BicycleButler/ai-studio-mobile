import { IReadableStore } from "../observable";

export interface IDisposable {
  dispose(): void;
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
