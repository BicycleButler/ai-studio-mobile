import { useState, useCallback, useRef, useEffect } from 'react';

export interface UseBulkActionConfirmProps {
  onConfirm: () => void;
  onClearSelection?: () => void;
}

export function useBulkActionConfirm({ onConfirm, onClearSelection }: UseBulkActionConfirmProps) {
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleteConfirmationText, setBulkDeleteConfirmationText] = useState("");

  const onConfirmRef = useRef(onConfirm);
  const onClearSelectionRef = useRef(onClearSelection);

  useEffect(() => {
    onConfirmRef.current = onConfirm;
    onClearSelectionRef.current = onClearSelection;
  }, [onConfirm, onClearSelection]);

  const handleBulkDelete = useCallback(() => {
    onConfirmRef.current();
    if (onClearSelectionRef.current) {
      onClearSelectionRef.current();
    }
    setShowBulkDeleteConfirm(false);
    setBulkDeleteConfirmationText("");
  }, []);

  return {
    showBulkDeleteConfirm,
    setShowBulkDeleteConfirm,
    bulkDeleteConfirmationText,
    setBulkDeleteConfirmationText,
    handleBulkDelete,
  };
}
