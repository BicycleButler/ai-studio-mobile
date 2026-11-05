import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

export interface BatchAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive';
}

export interface FloatingBatchActionBarProps {
  isVisible: boolean;
  selectedCount: number;
  actions?: BatchAction[];
  onClearSelection: () => void;
  children?: React.ReactNode;
  className?: string;
}

export const FloatingBatchActionBar: React.FC<FloatingBatchActionBarProps> = ({
  isVisible,
  selectedCount,
  actions = [],
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
          <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap px-1">
            {selectedCount} Selected
          </span>
          <div className="h-4 w-px bg-border/60" />

          {children}

          {actions.map((action, index) => (
            <button
              key={index}
              type="button"
              onClick={action.onClick}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                action.variant === 'destructive'
                  ? 'text-muted-foreground hover:bg-destructive/90 hover:text-destructive-foreground'
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              <span className="flex items-center justify-center [&>svg]:w-3.5 [&>svg]:h-3.5">
                {action.icon}
              </span>
              {action.label}
            </button>
          ))}

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
