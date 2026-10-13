import React from 'react';

export interface DatasetScopeBannerProps {
  selectedCount: number;
  totalCount: number;
  className?: string;
}

export const DatasetScopeBanner: React.FC<DatasetScopeBannerProps> = ({ selectedCount, totalCount, className }) => {
  if (selectedCount !== totalCount || totalCount === 0) {
    return null;
  }

  return (
    <div className={`text-[11px] text-muted-foreground bg-primary/5 px-2 py-1 rounded border border-primary/20 ${className || ''}`}>
      All {totalCount} items on this page are selected.
    </div>
  );
};
