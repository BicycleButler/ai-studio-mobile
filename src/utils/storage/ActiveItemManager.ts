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
  }

  public notify(state: ActiveItemManagerState<T>): void {
    super.notify(state);
    const currentActiveId = state.activeItem ? this.getId(state.activeItem) : null;
    if (this.lastActiveItemId !== currentActiveId) {
      this.lastActiveItemId = currentActiveId;
      if (this.onActiveItemChange) {
        this.onActiveItemChange(state.activeItem);
      }
    }
  }

  public getSnapshot(): ActiveItemManagerState<T> {
    return this.currentState!;
  }

  public getItems(): T[] {
    return this.collection.load();
  }

  public getActiveId(): string | null {
    const state = this.getSnapshot();
    return state.activeItem ? this.getId(state.activeItem) : null;
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
    super.dispose();
  }
}
