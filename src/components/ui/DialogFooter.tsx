import React from 'react';

export interface DialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const DialogFooter: React.FC<DialogFooterProps> = ({ children, className = '' }) => {
  return (
    <div className={`p-4 border-t border-border flex flex-wrap-reverse items-center justify-end gap-2 bg-muted/30 shrink-0 ${className}`}>
      {children}
    </div>
  );
};
