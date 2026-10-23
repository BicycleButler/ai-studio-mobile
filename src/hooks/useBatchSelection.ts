import React, { useMemo, useCallback, useEffect } from 'react';
import { BatchSelectionManager, SelectionState } from '../utils/batchSelectionManager';
import { useStore } from './useStore';

export interface UseBatchSelectionProps<T> {
  items: T[];
  getItemId: (item: T) => string;
  clearOnDependencies?: unknown[];
}

export function useBatchSelection<T>({ items, getItemId, clearOnDependencies = [] }: UseBatchSelectionProps<T>) {
  const manager = useMemo(() => new BatchSelectionManager<T>(getItemId), [getItemId]);
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

  const toggleSelection = useCallback(
    (id: string, e: React.MouseEvent | React.KeyboardEvent, index: number, filteredList: T[] = items) => {
      e.stopPropagation();
      manager.toggleSelection(id, e.shiftKey, index, filteredList);
    },
    [manager, items]
  );

  const toggleSelectAll = useCallback(
    (filteredList?: T[]) => {
      manager.toggleSelectAll(filteredList || items);
    },
    [manager, items]
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
      return manager.getSelectionState(filteredList || items);
    },
    [manager, items]
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
