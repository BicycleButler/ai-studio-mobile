import { IReadableStore } from "../observable";
import { ComputedStore } from "../computedStore";
import { IMutableCollection, IMutableSingleton } from "./types";
import { ISelectionStrategy, FirstItemSelectionStrategy, NoImplicitSelectionStrategy } from "./selectionStrategy";

export interface ActiveItemManagerOptions<T> {
  collection: IMutableCollection<T>;
  activeIdSingleton: IMutableSingleton<string | null>;
  getId: (item: T) => string;
  allowImplicitSelection?: boolean; // Deprecated, use implicitSelectionStrategy
  implicitSelectionStrategy?: ISelectionStrategy<T>;
}

export interface ActiveItemManagerState<T> {
  items: T[];
  activeId: string | null;
  activeItem: T | null;
}

export interface IActiveItemManager<T> extends IReadableStore<ActiveItemManagerState<T>> {
  collection: IMutableCollection<T>;
  activeIdSingleton: IMutableSingleton<string | null>;
  getItems(): T[];
  getActiveId(): string | null;
  setActiveId(id: string | null): void;
  getActiveItem(): T | null;
  dispose(): void;
}

export class ActiveItemManager<T> extends ComputedStore<ActiveItemManagerState<T>> implements IActiveItemManager<T> {
  public collection: IMutableCollection<T>;
  public activeIdSingleton: IMutableSingleton<string | null>;
  private getId: (item: T) => string;
  private implicitSelectionStrategy: ISelectionStrategy<T>;

  constructor(options: ActiveItemManagerOptions<T>) {
    let implicitSelectionStrategy = options.implicitSelectionStrategy;

    if (!implicitSelectionStrategy) {
        if (options.allowImplicitSelection === false) {
             implicitSelectionStrategy = new NoImplicitSelectionStrategy<T>();
        } else {
             implicitSelectionStrategy = new FirstItemSelectionStrategy<T>();
        }
    }

    super([options.collection, options.activeIdSingleton], () => {
      const items = options.collection.load() || [];
      const activeId = options.activeIdSingleton.load() || null;

      let activeItem: T | null = null;
      let effectiveActiveId: string | null = null;

      if (items.length > 0) {
        if (activeId) {
          const match = items.find((p) => options.getId(p) === activeId);
          if (match) activeItem = match;
          else {
              activeItem = implicitSelectionStrategy.selectImplicitItem(items, options.getId);
          }
        } else {
          activeItem = implicitSelectionStrategy.selectImplicitItem(items, options.getId);
        }
      }

      effectiveActiveId = activeItem ? options.getId(activeItem) : null;

      return { items, activeId: effectiveActiveId, activeItem };
    });

    this.collection = options.collection;
    this.activeIdSingleton = options.activeIdSingleton;
    this.getId = options.getId;
    this.implicitSelectionStrategy = implicitSelectionStrategy;
  }

  public getSnapshot(): ActiveItemManagerState<T> {
    // Because ComputedStore may defer state re-computation via a microtask for batching,
    // we must call super.getSnapshot() here instead of simply returning this.currentState!
    // to force a synchronous evaluation of any dirty dependencies before returning.
    const state = super.getSnapshot()!;
    return state;
  }

  public getItems(): T[] {
    return this.collection.load();
  }

  public getActiveId(): string | null {
    const state = this.getSnapshot();
    return state.activeId;
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
