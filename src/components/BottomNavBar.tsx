import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Code2, Bot, Ticket } from "lucide-react";
import { PromptType } from "../types";

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
  const touchStartYRef = useRef<number | null>(null);

  const handleClose = () => {
    if (propIsOpen !== undefined) {
      onClose?.();
    } else {
      setInternalIsOpen(false);
    }
  };

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

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleSelect = (workspace: PromptType) => {
    onSelectWorkspace(workspace);
    handleClose();
  };

  const handleDrawerTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleDrawerTouchEnd = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    const diff = e.changedTouches[0].clientY - touchStartYRef.current;
    if (diff > 35) {
      handleClose();
    }
    touchStartYRef.current = null;
  };

  return (
    <>
      {/* Expanded Bottom-Up Drawer Modal Overlay & Container (z-50 backdrop, z-60 drawer) */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            id="workspace-drawer-backdrop"
            className="fixed inset-0 z-50 bg-black/40 transition-opacity animate-in fade-in duration-150 motion-reduce:animate-none"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Bottom-Up Drawer */}
          <div className="fixed bottom-0 left-0 right-0 z-60 flex justify-center pointer-events-none">
            <nav
              id="android-bottom-nav"
              role="navigation"
              aria-label="Workspace navigation"
              aria-expanded={true}
              onTouchStart={handleDrawerTouchStart}
              onTouchEnd={handleDrawerTouchEnd}
              className="pointer-events-auto w-full max-w-lg bg-background border-t border-x border-border rounded-t-2xl shadow-2xl px-2 pt-1.5 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] select-none animate-in slide-in-from-bottom duration-200 ease-out motion-reduce:animate-none"
            >
            {/* Top Grab / Dismiss Handle */}
            <div
              id="workspace-drawer-dismiss-bar"
              onClick={handleClose}
              className="w-full flex items-center justify-center py-1 cursor-pointer group"
              title="Collapse drawer"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleClose();
                }
              }}
              aria-label="Collapse workspace drawer"
            >
              <div className="w-10 h-1 rounded-full bg-muted-foreground/40 group-hover:bg-muted-foreground/70 transition-colors" />
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
          </nav>
        </div>
      </>
    )}
    </>
  );
};
