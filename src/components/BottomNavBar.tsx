import React, { useState, useEffect } from "react";
import { MessageSquare, Code2, Bot, Ticket, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PromptType } from "../types";
import { useBackNavigation } from "../hooks/useBackNavigation";
import { safeAddEventListener } from "../utils/platform";

interface BottomNavBarProps {
  activeWorkspace: PromptType;
  onSelectWorkspace: (workspace: PromptType) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

interface WorkspaceItem {
  id: PromptType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tooltip: string;
  badge?: string;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeWorkspace,
  onSelectWorkspace,
  isOpen: propIsOpen,
  onClose,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = propIsOpen !== undefined ? propIsOpen : internalIsOpen;

  const handleClose = () => {
    if (propIsOpen !== undefined) {
      onClose?.();
    } else {
      setInternalIsOpen(false);
    }
  };

  // Enable device/browser back navigation to dismiss drawer smoothly
  useBackNavigation(Boolean(isOpen), handleClose, "bottom-nav-drawer");

  const workspaces: WorkspaceItem[] = [
    {
      id: "chat",
      label: "Chat",
      icon: MessageSquare,
      tooltip: "Conversational multimodal chat & prompt tools",
    },
    {
      id: "code",
      label: "Mobile IDE",
      icon: Code2,
      tooltip: "Execute code snippets & prompt payloads",
    },
    {
      id: "jules",
      label: "Jules",
      icon: Bot,
      tooltip: "Autonomous GitHub coding agent",
    },
    {
      id: "stubs",
      label: "Stubs",
      icon: Ticket,
      tooltip: "Architecture-as-Code PWM Portal",
    },
  ];

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    const removeKey = safeAddEventListener("keydown", handleKeyDown);
    return () => removeKey();
  }, [isOpen]);

  const handleSelect = (workspace: PromptType) => {
    onSelectWorkspace(workspace);
    handleClose();
  };

  return (
    <AnimatePresence>
      {/* Expanded Bottom-Up Drawer Modal Overlay & Container (z-50 backdrop, z-60 drawer) */}
      {isOpen && (
        <React.Fragment key="workspace-drawer-fragment">
          {/* Backdrop */}
          <motion.div
            key="workspace-drawer-backdrop"
            id="workspace-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.26, ease: "easeOut" }}
            className="fixed inset-0 z-50 bg-black/40"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Bottom-Up Drawer */}
          <div className="fixed bottom-0 left-0 right-0 z-60 flex justify-center pointer-events-none">
            <motion.nav
              key="android-bottom-nav"
              id="android-bottom-nav"
              role="navigation"
              aria-label="Workspace navigation"
              aria-expanded={true}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 1.26, ease: [0.32, 0.72, 0, 1] }}
              className="pointer-events-auto w-full max-w-lg bg-background border-t border-x border-border rounded-t-2xl shadow-2xl px-2 pt-1.5 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] select-none"
            >
              {/* Top Bar with Title and X close button */}
              <div className="flex items-center justify-between px-2 pt-0.5 pb-1">
                <span className="text-xs font-semibold text-muted-foreground px-1">Workspaces</span>
                <button
                  type="button"
                  id="bottom-nav-close-btn"
                  onClick={handleClose}
                  className="w-7 h-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                  title="Close drawer"
                  aria-label="Close drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 4-Slot Workspace layout with generous touch ergonomics */}
              <div className="grid grid-cols-4 max-w-lg mx-auto mt-0.5 gap-1">
                {workspaces.map((ws) => {
                  const Icon = ws.icon;
                  const isActive = activeWorkspace === ws.id;

                  return (
                    <button
                      key={ws.id}
                      id={`nav-workspace-${ws.id}`}
                      onClick={() => handleSelect(ws.id)}
                      className="flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-colors relative group cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[48px]"
                      title={ws.tooltip}
                      aria-label={ws.label}
                    >
                      {/* Material You rounded pill highlight */}
                      <div
                        className={`flex items-center justify-center w-14 h-7.5 rounded-full transition-colors duration-200 relative ${
                          isActive
                            ? "bg-primary/20 text-primary"
                            : "text-muted-foreground group-hover:text-foreground group-hover:bg-muted/70"
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 transition-transform duration-150 ${
                            isActive ? "scale-110 stroke-[2.2]" : "stroke-[1.8]"
                          }`}
                        />
                      </div>
                      <span
                        className={`text-[11px] mt-0.5 tracking-tight transition-colors truncate max-w-[72px] text-center ${
                          isActive
                            ? "text-primary font-semibold"
                            : "text-muted-foreground group-hover:text-foreground"
                        }`}
                      >
                        {ws.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.nav>
          </div>
        </React.Fragment>
      )}
    </AnimatePresence>
  );
};
