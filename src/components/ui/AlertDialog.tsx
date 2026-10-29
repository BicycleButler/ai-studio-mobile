import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGlobalKeydown } from '../../hooks/useGlobalKeydown';

export interface AlertDialogProps {
  isOpen: boolean;
  onClose?: () => void;
  title: string;
  description?: React.ReactNode;
  cancelText?: string;
  confirmText?: string;
  onCancel: () => void;
  onConfirm: () => void;
  isConfirmDisabled?: boolean;
  confirmVariant?: 'default' | 'destructive';
  children?: React.ReactNode;
}

export const AlertDialog: React.FC<AlertDialogProps> = ({
  isOpen,
  title,
  description,
  cancelText = "Cancel",
  confirmText = "Confirm",
  onCancel,
  onConfirm,
  isConfirmDisabled = false,
  confirmVariant = 'destructive',
  children,
  onClose
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus cancel button on open (ADR 0032 §7)
  useEffect(() => {
    if (isOpen && cancelRef.current) {
      cancelRef.current.focus();
    }
  }, [isOpen]);

  useGlobalKeydown('Escape', () => {
    if (onClose) {
      onClose();
    } else {
      onCancel();
    }
  }, { isActive: isOpen, ignoreIfInputFocused: false });

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-80 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-sm bg-card border border-border rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-4 border-b border-border shrink-0">
              <h3 id="alert-dialog-title" className="text-lg font-semibold text-foreground">
                {title}
              </h3>
            </div>

            {/* Body */}
            <div className="p-4 text-sm text-muted-foreground overflow-y-auto flex-1">
              {description && (
                <div id="alert-dialog-description" className="mb-4">
                  {description}
                </div>
              )}
              {children}
            </div>

            {/* Footer */}
            <div className="p-4 bg-muted/30 flex justify-end gap-3 border-t border-border shrink-0">
              <button
                type="button"
                ref={cancelRef}
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-foreground bg-transparent border border-border rounded-lg hover:bg-muted transition-colors cursor-pointer"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isConfirmDisabled}
                className={`px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                  confirmVariant === 'destructive'
                    ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                    : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                }`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
