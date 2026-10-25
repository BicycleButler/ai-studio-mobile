import React from 'react';

export interface DialogBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const DialogBody: React.FC<DialogBodyProps> = ({ children, className = '' }) => {
  return (
    <div className={`p-4 overflow-y-auto flex-1 ${className}`}>
      {children}
    </div>
  );
};
