import React, { useCallback, useEffect, useMemo } from 'react';
import { IBatchSelectionManager, SelectionState } from '../utils/batchSelectionManager';
import { useStore } from './useStore';
import { useServices } from '../services/ServiceContext';

export interface UseBatchSelectionProps<T> {
  items: T[];
  getItemId: (item: T) => string;
  clearOnDependencies?: unknown[];
  managerFactory?: () => IBatchSelectionManager;
  isActive?: boolean;
  enableShortcuts?: boolean;
}

export function useBatchSelection<T>({
  items,
  getItemId,
  clearOnDependencies = [],
  managerFactory,
  isActive = true,
  enableShortcuts = false
}: UseBatchSelectionProps<T>) {
  const { platformService, createBatchSelectionManager } = useServices();
  const [manager] = React.useState<IBatchSelectionManager>(() => managerFactory ? managerFactory() : createBatchSelectionManager());

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
    (id: string, e: React.MouseEvent | React.KeyboardEvent, index: number, filteredIds?: string[]) => {
      e.stopPropagation();
      const activeItemIds = filteredIds || itemIds;
      manager.toggleSelection(id, e.shiftKey, index, activeItemIds);
    },
    [manager, itemIds]
  );

  const toggleSelectAll = useCallback(
    (filteredIds?: string[]) => {
      const activeItemIds = filteredIds || itemIds;
      manager.toggleSelectAll(activeItemIds);
    },
    [manager, itemIds]
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
    (filteredIds?: string[]): SelectionState => {
      const activeItemIds = filteredIds || itemIds;
      return manager.getSelectionState(activeItemIds);
    },
    [manager, itemIds]
  );

  useEffect(() => {
    if (!isActive || !enableShortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (manager.getSnapshot().selectedIds.size > 0) {
          manager.clearSelection();
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        if (!platformService.isInputFocused()) {
          e.preventDefault();
          manager.toggleSelectAll(itemIds);
        }
      }
    };

    const removeKey = platformService.addEventListener("keydown", handleKeyDown);
    return () => removeKey();
  }, [isActive, enableShortcuts, itemIds, manager, platformService]);


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
