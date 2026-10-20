import { CollectionOperationResult, ICollectionEngine } from "./types";
import { fastShallowEqual } from "./helpers";

export class ArrayCollection<T> implements ICollectionEngine<T> {
  private keyExtractor: (item: T) => string;

  constructor(keyExtractor: (item: T) => string) {
    this.keyExtractor = keyExtractor;
  }

  update(items: T[], id: string, updates: Partial<T>): CollectionOperationResult<T> {
    const index = items.findIndex((item) => this.keyExtractor(item) === id);
    if (index === -1) return { items, changed: false, item: null };

    const existing = items[index];
    const updatedItem = { ...existing, ...updates } as T;

    if (fastShallowEqual(existing, updatedItem)) {
      return { items, changed: false, item: existing };
    }

    const newItems = [...items];
    newItems[index] = updatedItem;
    return { items: newItems, changed: true, item: updatedItem };
  }

  bulkUpdate(items: T[], updates: { id: string; changes: Partial<T> }[]): CollectionOperationResult<T> {
    if (!updates || updates.length === 0) return { items, changed: false };

    let changed = false;
    const updatesMap = new Map<string, Partial<T>>();
    for (const update of updates) {
      const existing = updatesMap.get(update.id);
      updatesMap.set(update.id, existing ? { ...existing, ...update.changes } : update.changes);
    }

    const newItems = [...items];
    for (let i = 0; i < newItems.length; i++) {
      const id = this.keyExtractor(newItems[i]);
      const changes = updatesMap.get(id);
      if (changes !== undefined) {
        const updatedItem = { ...newItems[i], ...changes } as T;
        if (!fastShallowEqual(newItems[i], updatedItem)) {
           newItems[i] = updatedItem;
           changed = true;
        }
      }
    }
    return { items: changed ? newItems : items, changed };
  }

  bulkDelete(items: T[], ids: string[]): CollectionOperationResult<T> {
    if (!ids || ids.length === 0) return { items, changed: false };

    const idSet = new Set(ids);
    const originalLength = items.length;
    const filtered = items.filter((item) => !idSet.has(this.keyExtractor(item)));
    return { items: filtered, changed: filtered.length !== originalLength };
  }

  delete(items: T[], id: string): CollectionOperationResult<T> {
    return this.bulkDelete(items, [id]);
  }

  upsert(items: T[], item: T, prepend = false): CollectionOperationResult<T> {
    const id = this.keyExtractor(item);
    const index = items.findIndex((i) => this.keyExtractor(i) === id);
    const updatedItem = { ...item } as T;

    if (index >= 0) {
      if (fastShallowEqual(items[index], updatedItem)) {
        return { items, changed: false, item: items[index] };
      }
      const newItems = [...items];
      newItems[index] = updatedItem;
      return { items: newItems, changed: true, item: updatedItem };
    }

    const newItems = [...items];
    prepend ? newItems.unshift(updatedItem) : newItems.push(updatedItem);
    return { items: newItems, changed: true, item: updatedItem };
  }

  bulkUpsert(items: T[], newItems: T[], prepend = false): CollectionOperationResult<T> {
    if (!newItems || newItems.length === 0) return { items, changed: false };

    const indexMap = new Map<string, number>();
    for (let i = 0; i < items.length; i++) {
      indexMap.set(this.keyExtractor(items[i]), i);
    }

    const collapsedNewItems = new Map<string, T>();
    for (const item of newItems) {
      const id = this.keyExtractor(item);
      collapsedNewItems.set(id, { ...item });
    }

    const nextItems = [...items];
    const itemsToAdd: T[] = [];
    let changed = false;

    for (const [id, updatedItem] of collapsedNewItems.entries()) {
      const index = indexMap.get(id);
      if (index !== undefined) {
        if (!fastShallowEqual(nextItems[index], updatedItem)) {
          nextItems[index] = updatedItem;
          changed = true;
        }
      } else {
        itemsToAdd.push(updatedItem);
        changed = true;
      }
    }

    if (itemsToAdd.length > 0) {
      if (prepend) {
          nextItems.unshift(...itemsToAdd);
      } else {
          nextItems.push(...itemsToAdd);
      }
    }

    return { items: changed ? nextItems : items, changed };
  }
}
