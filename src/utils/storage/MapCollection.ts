import { CollectionOperationResult, ICollectionEngine } from "./types";
import { fastDeepEqual } from "./helpers";

export class MapCollection<T> implements ICollectionEngine<T> {
  private keyExtractor: (item: T) => string;

  constructor(keyExtractor: (item: T) => string) {
    this.keyExtractor = keyExtractor;
  }

  update(items: T[], id: string, updates: Partial<T>): CollectionOperationResult<T> {
    return this.bulkUpdate(items, [{ id, changes: updates }]);
  }

  private applyMutations(
    items: T[],
    mutationsMap: Map<string, Partial<T> | T>,
    isUpsert: boolean,
    prepend: boolean
  ): CollectionOperationResult<T> {
    let changed = false;
    let nextItems: T[] | undefined = undefined;
    let updateCount = 0;
    let singleUpdatedItem: T | null | undefined = undefined;

    for (let i = 0; i < items.length; i++) {
      const existing = items[i];
      const id = this.keyExtractor(existing);
      const changes = mutationsMap.get(id);

      if (changes !== undefined) {
        if (isUpsert) {
          mutationsMap.delete(id); // Marked as updated, remove from additions
        }

        const mutated = (isUpsert ? changes : { ...existing, ...changes }) as T;
        if (!fastDeepEqual(existing, mutated)) {
          if (!nextItems) nextItems = [...items];
          nextItems[i] = mutated;
          changed = true;
          updateCount++;
          singleUpdatedItem = mutated;
        }
      }
    }

    if (isUpsert) {
      const itemsToAdd: T[] = Array.from(mutationsMap.values()) as T[];
      if (itemsToAdd.length > 0) {
        if (!nextItems) nextItems = [...items];
        if (prepend) {
          nextItems.unshift(...itemsToAdd);
        } else {
          nextItems.push(...itemsToAdd);
        }
        changed = true;
        updateCount += itemsToAdd.length;
        singleUpdatedItem = itemsToAdd[0];
      }
    }

    return {
      items: changed && nextItems ? nextItems : items,
      changed,
      item: updateCount === 1 && singleUpdatedItem !== undefined ? singleUpdatedItem : null
    };
  }

  bulkUpdate(items: T[], updates: { id: string; changes: Partial<T> }[]): CollectionOperationResult<T> {
    if (!updates || updates.length === 0) return { items, changed: false, item: null };

    const updatesMap = new Map<string, Partial<T>>();
    for (const update of updates) {
      const existing = updatesMap.get(update.id);
      updatesMap.set(update.id, existing ? { ...existing, ...update.changes } : update.changes);
    }

    return this.applyMutations(items, updatesMap, false, false);
  }

  delete(items: T[], id: string): CollectionOperationResult<T> {
    return this.bulkDelete(items, [id]);
  }

  bulkDelete(items: T[], ids: string[]): CollectionOperationResult<T> {
    if (!ids || ids.length === 0) return { items, changed: false, item: null };

    const idSet = new Set(ids);
    const originalLength = items.length;
    let deletedItem: T | undefined = undefined;
    let deletedCount = 0;

    const filtered = items.filter((item) => {
        if(idSet.has(this.keyExtractor(item))) {
            deletedCount++;
            deletedItem = item;
            return false;
        }
        return true;
    });

    return {
        items: filtered,
        changed: filtered.length !== originalLength,
        item: deletedCount === 1 && deletedItem !== undefined ? deletedItem : null
    };
  }

  upsert(items: T[], item: T, prepend = false): CollectionOperationResult<T> {
    return this.bulkUpsert(items, [item], prepend);
  }

  bulkUpsert(items: T[], newItems: T[], prepend = false): CollectionOperationResult<T> {
    if (!newItems || newItems.length === 0) return { items, changed: false, item: null };

    const collapsedNewItems = new Map<string, Partial<T> | T>();
    for (const item of newItems) {
      const id = this.keyExtractor(item);
      collapsedNewItems.set(id, { ...item }); // collapse duplicates
    }

    return this.applyMutations(items, collapsedNewItems, true, prepend);
  }
}
