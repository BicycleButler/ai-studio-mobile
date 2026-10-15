import { useState, useCallback } from 'react';

export interface UseBatchSelectionProps<T> {
  items: T[];
  getItemId: (item: T) => string;
  onBulkDelete?: (ids: string[]) => void;
}

export function useBatchSelection<T>({ items, getItemId, onBulkDelete }: UseBatchSelectionProps<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleteConfirmationText, setBulkDeleteConfirmationText] = useState("");

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
      if (selectedIds.size === filteredList.length && filteredList.length > 0) {
        setSelectedIds(new Set());
      } else {
        setSelectedIds(new Set(filteredList.map((item) => getItemId(item))));
      }
    },
    [selectedIds.size, items, getItemId]
  );

  const removeFromSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleBulkDelete = useCallback(() => {
    if (onBulkDelete) {
      onBulkDelete(Array.from(selectedIds));
    }
    clearSelection();
    setShowBulkDeleteConfirm(false);
    setBulkDeleteConfirmationText("");
  }, [onBulkDelete, selectedIds, clearSelection]);


  return {
    selectedIds,
    lastSelectedId,
    showBulkDeleteConfirm,
    setShowBulkDeleteConfirm,
    bulkDeleteConfirmationText,
    setBulkDeleteConfirmationText,
    toggleSelection,
    toggleSelectAll,
    clearSelection,
    handleBulkDelete,
    removeFromSelection,
  };
}
