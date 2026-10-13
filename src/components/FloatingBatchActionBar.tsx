import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, X } from 'lucide-react';

export interface FloatingBatchActionBarProps {
  isVisible: boolean;
  selectedCount: number;
  onDelete?: () => void;
  onClearSelection: () => void;
  children?: React.ReactNode;
  className?: string;
}

export const FloatingBatchActionBar: React.FC<FloatingBatchActionBarProps> = ({
  isVisible,
  selectedCount,
  onDelete,
  onClearSelection,
  children,
  className
}) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: 20, x: "-50%" }}
          className={`fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-[60] shadow-lg bg-background/95 backdrop-blur-md border border-border/60 rounded-full px-4 py-2 flex items-center gap-3 ${className || ''}`}
        >
          <span className="text-xs font-semibold px-2 py-1 bg-muted rounded-full whitespace-nowrap">
            {selectedCount} Selected
          </span>
          <div className="h-4 w-px bg-border/60" />

          {children}

          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-full transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          )}

          <button
            type="button"
            onClick={onClearSelection}
            className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:bg-muted rounded-full transition-colors cursor-pointer"
            aria-label="Clear selection"
            title="Deselect all (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
