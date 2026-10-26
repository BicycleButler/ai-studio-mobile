import React, { useCallback, useEffect, useMemo } from 'react';
import { BatchSelectionManager, SelectionState } from '../utils/batchSelectionManager';
import { useStore } from './useStore';

export interface UseBatchSelectionProps<T> {
  items: T[];
  getItemId: (item: T) => string;
  clearOnDependencies?: unknown[];
}

export function useBatchSelection<T>({ items, getItemId, clearOnDependencies = [] }: UseBatchSelectionProps<T>) {
  const [manager] = React.useState(() => new BatchSelectionManager());

  const state = useStore(manager);

  // ADR 0047 Option A: Clear selection on filter/tab changes
  const prevDepsRef = React.useRef(clearOnDependencies);
  useEffect(() => {
    if (clearOnDependencies.length > 0) {
      const hasChanged = clearOnDependencies.some((dep, i) => Object.is(dep, prevDepsRef.current[i]) === false);
      if (hasChanged) {
        manager.clearSelection();
      }
    }
    prevDepsRef.current = clearOnDependencies;
  }, [clearOnDependencies, manager]);

  const itemIds = useMemo(() => items.map(getItemId), [items, getItemId]);

  const toggleSelection = useCallback(
    (id: string, e: React.MouseEvent | React.KeyboardEvent, index: number, filteredList: T[] = items) => {
      e.stopPropagation();
      const filteredItemIds = filteredList === items ? itemIds : filteredList.map(getItemId);
      manager.toggleSelection(id, e.shiftKey, index, filteredItemIds);
    },
    [manager, items, itemIds, getItemId]
  );

  const toggleSelectAll = useCallback(
    (filteredList?: T[]) => {
      const filteredItemIds = filteredList ? filteredList.map(getItemId) : itemIds;
      manager.toggleSelectAll(filteredItemIds);
    },
    [manager, itemIds, getItemId]
  );

  const clearSelection = useCallback(() => {
    manager.clearSelection();
  }, [manager]);

  const removeFromSelection = useCallback(
    (id: string) => {
      manager.removeFromSelection(id);
    },
    [manager]
  );

  const getSelectionState = useCallback(
    (filteredList?: T[]): SelectionState => {
      const filteredItemIds = filteredList ? filteredList.map(getItemId) : itemIds;
      return manager.getSelectionState(filteredItemIds);
    },
    [manager, itemIds, getItemId]
  );

  return {
    selectedIds: state.selectedIds,
    lastSelectedId: state.lastSelectedId,
    toggleSelection,
    toggleSelectAll,
    clearSelection,
    removeFromSelection,
    getSelectionState,
  };
}
export type { SelectionState };
