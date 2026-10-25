import React from 'react';
import { AlertDialog } from './ui/AlertDialog';

export interface BulkDeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedCount: number;
  itemType: string;
  confirmationText: string;
  onConfirmationTextChange: (text: string) => void;
}

export const BulkDeleteConfirmModal: React.FC<BulkDeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
  itemType,
  confirmationText,
  onConfirmationTextChange
}) => {
  const isButtonDisabled = selectedCount > 100 && confirmationText !== selectedCount.toString();
  const pluralItemType = selectedCount === 1 ? itemType : `${itemType}s`;

  return (
    <AlertDialog
      isOpen={isOpen}
      onCancel={onClose}
      onConfirm={onConfirm}
      title={`Delete ${selectedCount} selected ${pluralItemType}?`}
      description={`This action cannot be undone. This will permanently delete the selected ${pluralItemType} from your local storage.`}
      confirmText={`Delete ${selectedCount} ${pluralItemType}`}
      confirmVariant="destructive"
      isConfirmDisabled={isButtonDisabled}
    >
      {selectedCount > 100 && (
        <div className="mt-4">
          <label className="block text-xs font-medium text-foreground mb-1">
            Type the exact quantity ({selectedCount}) to confirm:
          </label>
          <input
            type="text"
            value={confirmationText}
            onChange={(e) => onConfirmationTextChange(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-destructive"
            placeholder={`e.g., ${selectedCount}`}
          />
        </div>
      )}
    </AlertDialog>
  );
};
