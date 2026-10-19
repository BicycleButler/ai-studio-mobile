import { IReadableStore } from "../observable";
import { ComputedStore } from "../computedStore";

export interface IMutableCollection<T> extends IReadableStore<T[]> {
  save: (items: T[]) => void;
  delete: (id: string) => T[];
  bulkDelete: (ids: string[]) => T[];
  upsert: (item: T, prepend?: boolean) => T;
  update: (id: string, updates: Partial<T>) => T | null;
  load: () => T[];
}

export interface IMutableSingleton<T> extends IReadableStore<T> {
  save: (item: T) => void;
  clear: () => void;
  load: () => T;
}

export interface ActiveItemManagerOptions<T> {
  collection: IMutableCollection<T>;
  activeIdSingleton: IMutableSingleton<string | null>;
  getId: (item: T) => string;
  onActiveItemChange?: (activeItem: T | null) => void;
  allowImplicitSelection?: boolean;
}

export interface ActiveItemManagerState<T> {
  items: T[];
  activeId: string | null;
  activeItem: T | null;
}

export class ActiveItemManager<T> extends ComputedStore<ActiveItemManagerState<T>> implements IReadableStore<ActiveItemManagerState<T>> {
  public collection: IMutableCollection<T>;
  public activeIdSingleton: IMutableSingleton<string | null>;
  private getId: (item: T) => string;
  private onActiveItemChange?: (activeItem: T | null) => void;
  private allowImplicitSelection: boolean;
  private lastActiveItemId: string | null = null;

  constructor(options: ActiveItemManagerOptions<T>) {
    const allowImplicitSelection = options.allowImplicitSelection ?? true;

    super([options.collection, options.activeIdSingleton], () => {
      const items = options.collection.load() || [];
      const activeId = options.activeIdSingleton.load() || null;

      let activeItem: T | null = null;
      if (items.length > 0) {
        if (activeId) {
          const match = items.find((p) => options.getId(p) === activeId);
          if (match) activeItem = match;
          else activeItem = allowImplicitSelection ? items[0] : null;
        } else {
          activeItem = allowImplicitSelection ? items[0] : null;
        }
      }

      const state = { items, activeId, activeItem };

      // We need a slight hack here since the superclass constructor calls compute() immediately
      // before this.onActiveItemChange is assigned. We handle the callback in a separate method.
      return state;
    });

    this.collection = options.collection;
    this.activeIdSingleton = options.activeIdSingleton;
    this.getId = options.getId;
    this.onActiveItemChange = options.onActiveItemChange;
    this.allowImplicitSelection = allowImplicitSelection;

    // Call it initially
    const initialState = this.getSnapshot();
    this.lastActiveItemId = initialState.activeItem ? this.getId(initialState.activeItem) : null;

    // Subscribe to self to trigger the side effect when state changes
    this.subscribe((state) => {
      const currentActiveId = state.activeItem ? this.getId(state.activeItem) : null;
      if (this.lastActiveItemId !== currentActiveId) {
        this.lastActiveItemId = currentActiveId;
        if (this.onActiveItemChange) {
          this.onActiveItemChange(state.activeItem);
        }
      }
    });
  }

  public getSnapshot(): ActiveItemManagerState<T> {
    return this.currentState!;
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
  }

  public getActiveItem(): T | null {
    return this.getSnapshot().activeItem;
  }

  private syncActiveIdAfterDeletion(deletedIds: string[], remainingItems: T[]) {
    const activeId = this.getActiveId();
    if (activeId && deletedIds.includes(activeId)) {
      if (remainingItems.length > 0 && this.allowImplicitSelection) {
        this.setActiveId(this.getId(remainingItems[0]));
      } else {
        this.setActiveId(null);
      }
    }
  }

  public saveItems(items: T[]): void {
    this.collection.save(items);
    const activeId = this.getActiveId();
    if (activeId) {
      const match = items.find((p) => this.getId(p) === activeId);
      if (!match) {
        if (items.length > 0 && this.allowImplicitSelection) {
          this.setActiveId(this.getId(items[0]));
        } else {
          this.setActiveId(null);
        }
      }
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
    return this.collection.upsert(item, prepend);
  }

  public update(id: string, updates: Partial<T>): T | null {
    return this.collection.update(id, updates);
  }
}
