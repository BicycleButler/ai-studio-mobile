export class ArrayCollection<T> {
  private keyExtractor: (item: T) => string;

  constructor(keyExtractor: (item: T) => string) {
    this.keyExtractor = keyExtractor;
  }

  update(items: T[], id: string, updates: Partial<T>): { items: T[], changed: boolean, item: T | null } {
    const index = items.findIndex((item) => this.keyExtractor(item) === id);
    if (index === -1) return { items, changed: false, item: null };

    const newItems = [...items];
    const updatedItem = { ...newItems[index], ...updates } as T;
    newItems[index] = updatedItem;
    return { items: newItems, changed: true, item: updatedItem };
  }

  bulkUpdate(items: T[], updates: { id: string; changes: Partial<T> }[]): { items: T[], changed: boolean } {
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
        newItems[i] = { ...newItems[i], ...changes } as T;
        changed = true;
      }
    }
    return { items: newItems, changed };
  }

  bulkDelete(items: T[], ids: string[]): { items: T[], changed: boolean } {
    if (!ids || ids.length === 0) return { items, changed: false };

    const idSet = new Set(ids);
    const originalLength = items.length;
    const filtered = items.filter((item) => !idSet.has(this.keyExtractor(item)));
    return { items: filtered, changed: filtered.length !== originalLength };
  }

  delete(items: T[], id: string): { items: T[], changed: boolean } {
    return this.bulkDelete(items, [id]);
  }

  upsert(items: T[], item: T, prepend = false): { items: T[], changed: boolean, item: T } {
    const id = this.keyExtractor(item);
    const index = items.findIndex((i) => this.keyExtractor(i) === id);
    const updatedItem = { ...item } as T;

    const newItems = [...items];
    if (index >= 0) {
      newItems[index] = updatedItem;
    } else {
      prepend ? newItems.unshift(updatedItem) : newItems.push(updatedItem);
    }
    return { items: newItems, changed: true, item: updatedItem };
  }

  bulkUpsert(items: T[], newItems: T[], prepend = false): { items: T[], changed: boolean } {
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

    for (const [id, updatedItem] of collapsedNewItems.entries()) {
      const index = indexMap.get(id);
      if (index !== undefined) {
        nextItems[index] = updatedItem;
      } else {
        itemsToAdd.push(updatedItem);
      }
    }

    if (itemsToAdd.length > 0) {
      if (prepend) {
          nextItems.unshift(...itemsToAdd);
      } else {
          nextItems.push(...itemsToAdd);
      }
    }

    return { items: nextItems, changed: true };
  }
}
