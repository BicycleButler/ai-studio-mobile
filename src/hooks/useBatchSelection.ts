import { useState, useCallback } from 'react';

export interface UseBatchSelectionProps<T> {
  items: T[];
  getItemId: (item: T) => string;
}

export type SelectionState = 'none' | 'some' | 'all';

export function useBatchSelection<T>({ items, getItemId }: UseBatchSelectionProps<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setLastSelectedId(null);
  }, []);

  const toggleSelection = useCallback(
    (id: string, e: React.MouseEvent | React.KeyboardEvent, index: number, filteredList: T[] = items) => {
      e.stopPropagation();
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (e.shiftKey && lastSelectedId) {
          const lastIndex = filteredList.findIndex((item) => getItemId(item) === lastSelectedId);
          if (lastIndex !== -1) {
            const start = Math.min(index, lastIndex);
            const end = Math.max(index, lastIndex);
            for (let i = start; i <= end; i++) {
              next.add(getItemId(filteredList[i]));
            }
            return next;
          }
        }

        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      setLastSelectedId(id);
    },
    [lastSelectedId, items, getItemId]
  );

  const toggleSelectAll = useCallback(
    (filteredList: T[] = items) => {
      setSelectedIds((prev) => {
        const filteredIds = filteredList.map(getItemId);
        const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => prev.has(id));

        const next = new Set(prev);
        if (allFilteredSelected) {
          // Deselect all filtered items
          filteredIds.forEach(id => next.delete(id));
        } else {
          // Select all filtered items
          filteredIds.forEach(id => next.add(id));
        }
        return next;
      });
    },
    [getItemId, items]
  );

  const removeFromSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const getSelectionState = useCallback(
    (filteredList: T[] = items): SelectionState => {
      if (filteredList.length === 0) return 'none';
      const filteredIds = filteredList.map(getItemId);
      const selectedCount = filteredIds.filter(id => selectedIds.has(id)).length;
      if (selectedCount === 0) return 'none';
      if (selectedCount === filteredIds.length) return 'all';
      return 'some';
    },
    [selectedIds, items, getItemId]
  );

  return {
    selectedIds,
    lastSelectedId,
    toggleSelection,
    toggleSelectAll,
    clearSelection,
    removeFromSelection,
    getSelectionState,
  };
}
