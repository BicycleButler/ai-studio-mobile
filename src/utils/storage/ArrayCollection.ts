import { CollectionOperationResult, ICollectionEngine } from "./types";
import { fastDeepEqual } from "./helpers";

export class ArrayCollection<T> implements ICollectionEngine<T> {
  private keyExtractor: (item: T) => string;

  constructor(keyExtractor: (item: T) => string) {
    this.keyExtractor = keyExtractor;
  }

  private abstractMapMutate(
    items: T[],
    mutator: (item: T, id: string) => T | undefined,
    appendItems?: T[],
    prepend = false
  ): CollectionOperationResult<T> {
    let changed = false;
    let nextItems: T[] | undefined = undefined;
    let singleUpdatedItem: T | null | undefined = undefined;

    for (let i = 0; i < items.length; i++) {
      const existing = items[i];
      const id = this.keyExtractor(existing);
      const mutated = mutator(existing, id);

      if (mutated !== undefined && !fastDeepEqual(existing, mutated)) {
        if (!nextItems) nextItems = [...items];
        nextItems[i] = mutated;
        changed = true;
        singleUpdatedItem = mutated; // store for non-bulk single return
      } else if (mutated !== undefined) {
         // mutated but deeply equal
         singleUpdatedItem = mutated;
      }
    }

    if (appendItems && appendItems.length > 0) {
      if (!nextItems) nextItems = [...items];
      changed = true;
      singleUpdatedItem = appendItems[0];
      if (prepend) {
        nextItems.unshift(...appendItems);
      } else {
        nextItems.push(...appendItems);
      }
    }

    return {
      items: changed && nextItems ? nextItems : items,
      changed,
      item: singleUpdatedItem === undefined ? null : singleUpdatedItem
    };
  }

  update(items: T[], id: string, updates: Partial<T>): CollectionOperationResult<T> {
    const index = items.findIndex((item) => this.keyExtractor(item) === id);
    if (index === -1) return { items, changed: false, item: null };

    const existing = items[index];
    const updatedItem = { ...existing, ...updates } as T;

    if (fastDeepEqual(existing, updatedItem)) {
      return { items, changed: false, item: existing };
    }

    const newItems = [...items];
    newItems[index] = updatedItem;
    return { items: newItems, changed: true, item: updatedItem };
  }

  bulkUpdate(items: T[], updates: { id: string; changes: Partial<T> }[]): CollectionOperationResult<T> {
    if (!updates || updates.length === 0) return { items, changed: false };

    const updatesMap = new Map<string, Partial<T>>();
    for (const update of updates) {
      const existing = updatesMap.get(update.id);
      updatesMap.set(update.id, existing ? { ...existing, ...update.changes } : update.changes);
    }

    return this.abstractMapMutate(items, (item, currentId) => {
      const changes = updatesMap.get(currentId);
      if (changes !== undefined) {
        return { ...item, ...changes } as T;
      }
      return undefined;
    });
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

    if (index >= 0) {
       return this.abstractMapMutate(items, (_, currentId) => {
         if (currentId === id) return { ...item } as T;
         return undefined;
       });
    }

    return this.abstractMapMutate(items, () => undefined, [item], prepend);
  }

  bulkUpsert(items: T[], newItems: T[], prepend = false): CollectionOperationResult<T> {
    if (!newItems || newItems.length === 0) return { items, changed: false };

    const collapsedNewItems = new Map<string, T>();
    for (const item of newItems) {
      const id = this.keyExtractor(item);
      collapsedNewItems.set(id, { ...item }); // collapse duplicates
    }

    const itemsToAdd: T[] = [];

    const result = this.abstractMapMutate(items, (item, currentId) => {
       const updatedItem = collapsedNewItems.get(currentId);
       if (updatedItem !== undefined) {
           collapsedNewItems.delete(currentId);
           return updatedItem;
       }
       return undefined;
    });

    for (const item of collapsedNewItems.values()) {
        itemsToAdd.push(item);
    }

    if (itemsToAdd.length > 0) {
      if (prepend) {
        result.items = [...itemsToAdd, ...result.items];
      } else {
        result.items = [...result.items, ...itemsToAdd];
      }
      result.changed = true;
    }

    return result;
  }
}
