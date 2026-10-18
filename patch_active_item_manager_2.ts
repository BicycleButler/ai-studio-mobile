import * as fs from 'fs';

let content = fs.readFileSync('src/utils/storage/ActiveItemManager.ts', 'utf-8');

// The first patch got a bit garbled due to repeated replacements. Let's rewrite it cleanly.

content = `import { StorageCollection } from "./StorageCollection";
import { StorageSingleton } from "./StorageSingleton";
import { Observable, IReadableStore } from "../observable";

export interface ActiveItemManagerOptions<T> {
  collection: StorageCollection<T>;
  activeIdSingleton: StorageSingleton<string | null>;
  getId: (item: T) => string;
  onActiveItemChange?: (activeItem: T | null) => void;
}

export interface ActiveItemManagerState<T> {
  items: T[];
  activeId: string | null;
  activeItem: T | null;
}

export class ActiveItemManager<T> extends Observable<ActiveItemManagerState<T>> implements IReadableStore<ActiveItemManagerState<T>> {
  public collection: StorageCollection<T>;
  public activeIdSingleton: StorageSingleton<string | null>;
  private getId: (item: T) => string;
  private onActiveItemChange?: (activeItem: T | null) => void;

  constructor(options: ActiveItemManagerOptions<T>) {
    super({
      items: options.collection.load(),
      activeId: options.activeIdSingleton.load() ? options.activeIdSingleton.load() : null,
      activeItem: null
    });
    this.collection = options.collection;
    this.activeIdSingleton = options.activeIdSingleton;
    this.getId = options.getId;
    this.onActiveItemChange = options.onActiveItemChange;

    this.currentState!.activeItem = this.getActiveItem();

    // Reactively update when underlying storage changes (e.g. from other tabs)
    this.collection.subscribe(() => {
      this.recomputeState();
    });
    this.activeIdSingleton.subscribe(() => {
      this.recomputeState();
    });
  }

  private recomputeState(): void {
    const items = this.getItems();
    const activeId = this.getActiveId();
    let activeItem: T | null = null;
    if (items.length > 0) {
      if (activeId) {
        const match = items.find((p) => this.getId(p) === activeId);
        if (match) activeItem = match;
        else activeItem = items[0];
      } else {
        activeItem = items[0];
      }
    }

    this.notify({ items, activeId, activeItem });
  }

  public getItems(): T[] {
    return this.collection.load();
  }

  public getActiveId(): string | null {
    const val = this.activeIdSingleton.load();
    return val ? val : null;
  }

  public setActiveId(id: string | null): void {
    if (id) {
      this.activeIdSingleton.save(id);
    } else {
      this.activeIdSingleton.clear();
    }
    this.notifyActiveItemChange();
  }

  public getActiveItem(): T | null {
    const items = this.getItems();
    if (items.length === 0) return null;
    const activeId = this.getActiveId();
    if (activeId) {
      const match = items.find((p) => this.getId(p) === activeId);
      if (match) return match;
    }
    return items[0];
  }

  private notifyActiveItemChange(): void {
    if (this.onActiveItemChange) {
      this.onActiveItemChange(this.getActiveItem());
    }
    this.recomputeState();
  }

  private syncActiveIdAfterDeletion(deletedIds: string[], remainingItems: T[]) {
    const activeId = this.getActiveId();
    if (activeId && deletedIds.includes(activeId)) {
      if (remainingItems.length > 0) {
        this.setActiveId(this.getId(remainingItems[0]));
      } else {
        this.setActiveId(null);
      }
    } else if (!activeId && deletedIds.length > 0) {
      // If there's no active ID, getActiveItem() might have returned something that was deleted.
      this.notifyActiveItemChange();
    }
  }

  public saveItems(items: T[]): void {
    this.collection.save(items);
    const activeId = this.getActiveId();
    if (activeId) {
      const match = items.find((p) => this.getId(p) === activeId);
      if (!match) {
        if (items.length > 0) {
          this.setActiveId(this.getId(items[0]));
        } else {
          this.setActiveId(null);
        }
      } else {
        this.notifyActiveItemChange();
      }
    } else {
      this.notifyActiveItemChange();
    }
  }

  public delete(id: string): T[] {
    const filtered = this.collection.delete(id);
    this.syncActiveIdAfterDeletion([id], filtered);
    return filtered;
  }

  public bulkDelete(ids: string[]): T[] {
    const filtered = this.collection.bulkDelete(ids);
    this.syncActiveIdAfterDeletion(ids, filtered);
    return filtered;
  }

  public upsert(item: T, prepend = false): T {
    const result = this.collection.upsert(item, prepend);
    if (this.getActiveId() === this.getId(item)) {
      this.notifyActiveItemChange();
    } else if (!this.getActiveId()) {
      this.notifyActiveItemChange();
    }
    return result;
  }

  public update(id: string, updates: Partial<T>): T | null {
    const updated = this.collection.update(id, updates);
    if (updated && this.getActiveId() === id) {
      this.notifyActiveItemChange();
    } else if (!this.getActiveId()) {
      // In case the implicit active item was updated
      const activeItem = this.getActiveItem();
      if (activeItem && this.getId(activeItem) === id) {
        this.notifyActiveItemChange();
      }
    }
    return updated;
  }
}
`;

fs.writeFileSync('src/utils/storage/ActiveItemManager.ts', content);
