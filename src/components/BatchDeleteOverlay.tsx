import React from 'react';
import { FloatingBatchActionBar } from "./FloatingBatchActionBar";
import { BulkDeleteConfirmModal } from "./BulkDeleteConfirmModal";
import { useBulkActionConfirm } from "../hooks/useBulkActionConfirm";
import { Trash2 } from "lucide-react";

export interface BatchDeleteOverlayProps {
  selectedCount: number;
  itemType: string;
  onClearSelection: () => void;
  onDelete: () => void;
  isVisible?: boolean;
}

export const BatchDeleteOverlay: React.FC<BatchDeleteOverlayProps> = ({
  selectedCount,
  itemType,
  onClearSelection,
  onDelete,
  isVisible,
}) => {
  const {
    showBulkDeleteConfirm,
    setShowBulkDeleteConfirm,
    bulkDeleteConfirmationText,
    setBulkDeleteConfirmationText,
    handleBulkDelete,
  } = useBulkActionConfirm({
    onConfirm: onDelete,
    onClearSelection: onClearSelection,
  });

  const show = isVisible !== undefined ? isVisible : selectedCount > 0;

  return (
    <>
      <FloatingBatchActionBar
        isVisible={show}
        selectedCount={selectedCount}
        actions={[
          {
            label: 'Delete',
            icon: <Trash2 className="w-3.5 h-3.5" />,
            onClick: () => setShowBulkDeleteConfirm(true),
            variant: 'destructive'
          }
        ]}
        onClearSelection={onClearSelection}
      />
      <BulkDeleteConfirmModal
        isOpen={showBulkDeleteConfirm}
        onClose={() => {
          setShowBulkDeleteConfirm(false);
          setBulkDeleteConfirmationText("");
        }}
        onConfirm={handleBulkDelete}
        selectedCount={selectedCount}
        itemType={itemType}
        confirmationText={bulkDeleteConfirmationText}
        onConfirmationTextChange={setBulkDeleteConfirmationText}
      />
    </>
  );
};
