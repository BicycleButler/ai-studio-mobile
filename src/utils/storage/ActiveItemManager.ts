import { IReadableStore } from "../observable";
import { ComputedStore } from "../computedStore";
import { IMutableCollection, IMutableSingleton } from "./types";

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
  private selfUnsubscribe: () => void;
  private collectionUnsubscribe: () => void;

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

      return { items, activeId, activeItem };
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
    this.selfUnsubscribe = this.subscribe((state) => {
      const currentActiveId = state.activeItem ? this.getId(state.activeItem) : null;
      if (this.lastActiveItemId !== currentActiveId) {
        this.lastActiveItemId = currentActiveId;
        if (this.onActiveItemChange) {
          this.onActiveItemChange(state.activeItem);
        }
      }
    });

    // Subscribe to collection changes to sync active ID if the active item was deleted
    this.collectionUnsubscribe = this.collection.subscribe((items) => {
      const activeId = this.getActiveId();
      if (activeId && items) {
        const stillExists = items.some(p => this.getId(p) === activeId);
        if (!stillExists) {
          if (items.length > 0 && this.allowImplicitSelection) {
            this.setActiveId(this.getId(items[0]));
          } else {
            this.setActiveId(null);
          }
        }
      } else if (!activeId && items && items.length > 0 && this.allowImplicitSelection) {
        // If there's no active ID but items exist, auto-select the first one
        this.setActiveId(this.getId(items[0]));
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

  public dispose() {
    this.selfUnsubscribe();
    this.collectionUnsubscribe();
    super.dispose();
  }
}
