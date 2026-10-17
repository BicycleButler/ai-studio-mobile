import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

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
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-sm bg-card border border-border rounded-xl shadow-xl overflow-hidden"
          >
            <div className="p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">
                Delete {selectedCount} selected {pluralItemType}?
              </h3>
            </div>
            <div className="p-4 text-sm text-muted-foreground space-y-4">
              <p>
                This action cannot be undone. This will permanently delete the selected {pluralItemType} from your local storage.
              </p>
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
            </div>
            <div className="p-4 bg-muted/30 flex justify-end gap-3 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isButtonDisabled}
                className="px-4 py-2 text-sm font-semibold bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-lg shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Delete {selectedCount} {pluralItemType}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
