import { Observable } from "./observable";

export type SelectionState = 'none' | 'some' | 'all';

export interface BatchSelectionState {
  selectedIds: Set<string>;
  lastSelectedId: string | null;
}

export class BatchSelectionManager<T> extends Observable<BatchSelectionState> {
  private getItemId: (item: T) => string;

  constructor(getItemId: (item: T) => string) {
    super({ selectedIds: new Set<string>(), lastSelectedId: null });
    this.getItemId = getItemId;
  }

  public get selectedIds(): Set<string> {
    return this.currentState!.selectedIds;
  }

  public get lastSelectedId(): string | null {
    return this.currentState!.lastSelectedId;
  }

  public clearSelection(): void {
    this.notifySync({ selectedIds: new Set<string>(), lastSelectedId: null });
  }

  public toggleSelection(id: string, isShiftDown: boolean, index: number, items: T[]): void {
    const prev = this.currentState!;
    const nextIds = new Set(prev.selectedIds);
    let nextLastId = id;

    if (isShiftDown && prev.lastSelectedId) {
      const lastIndex = items.findIndex((item) => this.getItemId(item) === prev.lastSelectedId);
      if (lastIndex !== -1) {
        const start = Math.min(index, lastIndex);
        const end = Math.max(index, lastIndex);
        for (let i = start; i <= end; i++) {
          nextIds.add(this.getItemId(items[i]));
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

  public toggleSelectAll(filteredList: T[]): void {
    const prev = this.currentState!;
    const filteredIds = filteredList.map(this.getItemId);
    const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => prev.selectedIds.has(id));

    const nextIds = new Set(prev.selectedIds);
    if (allFilteredSelected) {
      // Deselect all filtered items
      filteredIds.forEach(id => nextIds.delete(id));
    } else {
      // Select all filtered items
      filteredIds.forEach(id => nextIds.add(id));
    }
    this.notifySync({ selectedIds: nextIds, lastSelectedId: prev.lastSelectedId });
  }

  public removeFromSelection(id: string): void {
    const prev = this.currentState!;
    const nextIds = new Set(prev.selectedIds);
    nextIds.delete(id);
    this.notifySync({ selectedIds: nextIds, lastSelectedId: prev.lastSelectedId === id ? null : prev.lastSelectedId });
  }

  public getSelectionState(filteredList: T[]): SelectionState {
    if (filteredList.length === 0) return 'none';
    const filteredIds = filteredList.map(this.getItemId);
    const selectedCount = filteredIds.filter(id => this.selectedIds.has(id)).length;
    if (selectedCount === 0) return 'none';
    if (selectedCount === filteredIds.length) return 'all';
    return 'some';
  }
}
