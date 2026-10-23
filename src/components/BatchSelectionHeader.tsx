import React from 'react';
import { Square, MinusSquare, CheckSquare } from 'lucide-react';
import { SelectionState } from '../utils/batchSelectionManager';
import { DatasetScopeBanner } from './DatasetScopeBanner';

export interface BatchSelectionHeaderProps {
  selectedCount: number;
  totalCount: number;
  selectionState: SelectionState;
  onToggleSelectAll: () => void;
  className?: string;
}

export const BatchSelectionHeader: React.FC<BatchSelectionHeaderProps> = ({
  selectedCount,
  totalCount,
  selectionState,
  onToggleSelectAll,
  className,
}) => {
  if (totalCount === 0) return null;

  return (
    <div className={`px-4 py-2 border-b border-border bg-muted/40 flex flex-col gap-2 text-xs ${className || ''}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleSelectAll}
          className="text-muted-foreground hover:text-foreground cursor-pointer flex items-center"
          aria-label="Select all items on this page"
        >
          {selectionState === 'all' ? (
            <CheckSquare className="w-4 h-4 text-primary" />
          ) : selectionState === 'some' ? (
            <MinusSquare className="w-4 h-4 text-primary" />
          ) : (
            <Square className="w-4 h-4" />
          )}
        </button>
        <span className="text-muted-foreground font-medium">
          {selectedCount > 0
            ? `${selectedCount} selected`
            : "Select all on this page"}
        </span>
      </div>
      {/* Dataset Scope Banner (ADR 0047) */}
      <DatasetScopeBanner
        selectedCount={selectedCount}
        totalCount={totalCount}
      />
    </div>
  );
};
