import React from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useBackNavigation } from "../../hooks/useBackNavigation";
import { useGlobalKeydown } from "../../hooks/useGlobalKeydown";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  drawerId: string;
  children: React.ReactNode;
  className?: string;
  position?: "bottom" | "right" | "full";
  hideHeader?: boolean;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  drawerId,
  children,
  className = "",
  position = "bottom",
  hideHeader = false,
}) => {
  // Enable device/browser back navigation to dismiss drawer smoothly
  useBackNavigation(isOpen, onClose, drawerId);

  useGlobalKeydown('Escape', () => {
    onClose();
  }, { isActive: isOpen, ignoreIfInputFocused: false });

  return (
    <AnimatePresence>
      {isOpen && (
        <React.Fragment key={`${drawerId}-fragment`}>
          {/* Backdrop */}
          <motion.div
            key={`${drawerId}-backdrop`}
            id={`${drawerId}-backdrop`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }} // adjusted duration for general use
            className="fixed inset-0 z-[60] bg-black/40"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer Container */}
          <div className={`fixed inset-0 z-70 pointer-events-none flex ${position === 'bottom' ? 'items-end justify-center' : position === 'right' ? 'justify-end' : 'justify-center items-center'}`}>
            <motion.div
              key={`${drawerId}-content`}
              id={drawerId}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title && !hideHeader ? `${drawerId}-title` : undefined}
              initial={position === "bottom" ? { y: "100%" } : position === "right" ? { x: "100%" } : { y: "100%" }}
              animate={position === "bottom" ? { y: 0 } : position === "right" ? { x: 0 } : { y: 0 }}
              exit={position === "bottom" ? { y: "100%" } : position === "right" ? { x: "100%" } : { y: "100%" }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }} // smooth, non-linear easing
              className={`pointer-events-auto bg-background flex flex-col ${
                position === 'bottom'
                  ? 'w-full max-w-lg border-t border-x border-border rounded-t-2xl shadow-2xl px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]'
                  : position === 'right'
                  ? 'w-full max-w-md h-full h-[100dvh] border-s border-border shadow-2xl'
                  : 'w-full h-full h-[100dvh] border-none shadow-2xl' // full
              } ${className}`}
            >
              {/* Header */}
              {!hideHeader && (
                <div className={`flex items-center justify-between pb-2 mb-2 ${position === 'right' || position === 'full' ? 'p-4 border-b border-border bg-card' : ''}`}>
                  {title ? (
                    <h2 id={`${drawerId}-title`} className="text-sm font-semibold text-foreground tracking-tight">
                      {title}
                    </h2>
                  ) : (
                    <div /> /* Empty div to push X button to the right if no title */
                  )}

                  <button
                    type="button"
                    onClick={onClose}
                    className="w-8 h-8 -mr-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                    title="Close"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Body */}
              <div className={`flex-1 overflow-y-auto ${!hideHeader && position !== 'right' && position !== 'full' ? 'no-scrollbar' : ''}`}>
                {children}
              </div>
            </motion.div>
          </div>
        </React.Fragment>
      )}
    </AnimatePresence>
  );
};
