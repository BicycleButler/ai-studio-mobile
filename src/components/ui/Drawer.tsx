import React, { useEffect } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useBackNavigation } from "../../hooks/useBackNavigation";
import { safeAddEventListener } from "../../utils/platform";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  drawerId: string;
  children: React.ReactNode;
  className?: string;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  drawerId,
  children,
  className = "",
}) => {
  // Enable device/browser back navigation to dismiss drawer smoothly
  useBackNavigation(isOpen, onClose, drawerId);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const removeKey = safeAddEventListener("keydown", handleKeyDown);
    return () => removeKey();
  }, [isOpen, onClose]);

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
            className="fixed inset-0 z-50 bg-black/40"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Bottom-Up Drawer */}
          <div className="fixed bottom-0 start-0 end-0 z-60 flex justify-center pointer-events-none">
            <motion.div
              key={`${drawerId}-content`}
              id={drawerId}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? `${drawerId}-title` : undefined}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }} // smooth, non-linear easing
              className={`pointer-events-auto w-full max-w-lg bg-background border-t border-x border-border rounded-t-2xl shadow-2xl px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] flex flex-col ${className}`}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-2 mb-2">
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

              {/* Body */}
              <div className="flex-1 overflow-y-auto no-scrollbar">
                {children}
              </div>
            </motion.div>
          </div>
        </React.Fragment>
      )}
    </AnimatePresence>
  );
};
