import { Observable, IObservable } from "./observable";

export type SelectionState = 'none' | 'some' | 'all';

export interface BatchSelectionState {
  selectedIds: Set<string>;
  lastSelectedId: string | null;
}

export interface IBatchSelectionManager extends IObservable<BatchSelectionState> {
  readonly selectedIds: Set<string>;
  readonly lastSelectedId: string | null;
  clearSelection(): void;
  toggleSelection(id: string, isShiftDown: boolean, index: number, itemIds: string[]): void;
  toggleSelectAll(filteredIds: string[]): void;
  removeFromSelection(id: string): void;
  getSelectionState(filteredIds: string[]): SelectionState;
  subscribe(listener: (state: BatchSelectionState) => void): () => void;
  getSnapshot(): BatchSelectionState;
}

export class BatchSelectionManager extends Observable<BatchSelectionState> implements IBatchSelectionManager {
  constructor() {
    super({ selectedIds: new Set<string>(), lastSelectedId: null });
  }

  public get selectedIds(): Set<string> {
    return this.currentState!.selectedIds;
  }

  public get lastSelectedId(): string | null {
    return this.currentState!.lastSelectedId;
  }

  public clearSelection(): void {
    if (this.selectedIds.size === 0 && this.lastSelectedId === null) return;
    this.notifySync({ selectedIds: new Set<string>(), lastSelectedId: null });
  }

  public toggleSelection(id: string, isShiftDown: boolean, index: number, itemIds: string[]): void {
    const prev = this.currentState!;
    const nextIds = new Set(prev.selectedIds);
    let nextLastId = id;

    if (isShiftDown && prev.lastSelectedId) {
      const lastIndex = itemIds.indexOf(prev.lastSelectedId);
      if (lastIndex !== -1) {
        const start = Math.min(index, lastIndex);
        const end = Math.max(index, lastIndex);
        for (let i = start; i <= end; i++) {
          nextIds.add(itemIds[i]);
        }
        this.notifySync({ selectedIds: nextIds, lastSelectedId: nextLastId });
        return;
      }
    }

    if (nextIds.has(id)) {
      nextIds.delete(id);
    } else {
      nextIds.add(id);
    }

    this.notifySync({ selectedIds: nextIds, lastSelectedId: nextLastId });
  }

  public toggleSelectAll(filteredIds: string[]): void {
    if (filteredIds.length === 0) return;

    const prev = this.currentState!;
    let allFilteredSelected = true;
    for (const id of filteredIds) {
      if (!prev.selectedIds.has(id)) {
        allFilteredSelected = false;
        break;
      }
    }

    const nextIds = new Set(prev.selectedIds);
    if (allFilteredSelected) {
      // Deselect all filtered items
      for (const id of filteredIds) {
        nextIds.delete(id);
      }
    } else {
      // Select all filtered items
      for (const id of filteredIds) {
        nextIds.add(id);
      }
    }

    // Only notify if something actually changed
    if (nextIds.size !== prev.selectedIds.size || !allFilteredSelected) {
        this.notifySync({ selectedIds: nextIds, lastSelectedId: prev.lastSelectedId });
    }
  }

  public removeFromSelection(id: string): void {
    const prev = this.currentState!;
    if (!prev.selectedIds.has(id)) return;
    const nextIds = new Set(prev.selectedIds);
    nextIds.delete(id);
    this.notifySync({ selectedIds: nextIds, lastSelectedId: prev.lastSelectedId === id ? null : prev.lastSelectedId });
  }

  public getSelectionState(filteredIds: string[]): SelectionState {
    if (filteredIds.length === 0) return 'none';
    let selectedCount = 0;
    for (const id of filteredIds) {
      if (this.selectedIds.has(id)) {
        selectedCount++;
      }
    }
    if (selectedCount === 0) return 'none';
    if (selectedCount === filteredIds.length) return 'all';
    return 'some';
  }
}
