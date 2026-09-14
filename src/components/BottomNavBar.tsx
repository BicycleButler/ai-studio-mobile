import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, FileText, Columns2, Code2, Bot } from "lucide-react";
import { PromptType } from "../types";

interface BottomNavBarProps {
  activeWorkspace: PromptType;
  onSelectWorkspace: (workspace: PromptType) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeWorkspace,
  onSelectWorkspace,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const touchStartYRef = useRef<number | null>(null);

  const workspaces = [
    {
      id: "chat" as PromptType,
      label: "Chat",
      icon: MessageSquare,
      tooltip: "Conversational multimodal chat",
    },
    {
      id: "freeform" as PromptType,
      label: "Freeform",
      icon: FileText,
      tooltip: "Direct prompt engineering workspace",
    },
    {
      id: "structured" as PromptType,
      label: "Structured",
      icon: Columns2,
      tooltip: "Few-shot input & output tables",
    },
    {
      id: "code" as PromptType,
      label: "Mobile IDE",
      icon: Code2,
      tooltip: "Execute code snippets & prompt payloads",
    },
    {
      id: "jules" as PromptType,
      label: "Jules",
      icon: Bot,
      tooltip: "Autonomous GitHub coding agent",
    },
  ];

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleSelect = (workspace: PromptType) => {
    onSelectWorkspace(workspace);
    setIsOpen(false);
  };

  // Touch gesture listeners for drag to expand/collapse
  const handlePeekTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handlePeekTouchEnd = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    const diff = touchStartYRef.current - e.changedTouches[0].clientY;
    if (diff > 25) {
      setIsOpen(true);
    }
    touchStartYRef.current = null;
  };

  const handleDrawerTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleDrawerTouchEnd = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    const diff = e.changedTouches[0].clientY - touchStartYRef.current;
    if (diff > 35) {
      setIsOpen(false);
    }
    touchStartYRef.current = null;
  };

  return (
    <>
      {/* Collapsed Minimal Drag Handle Peek (ADR 0045 docked safe-area bottom) */}
      {!isOpen && (
        <div
          id="workspace-drawer-peek-container"
          className="shrink-0 w-full flex flex-col items-center justify-end select-none bg-background/40 border-t border-border/30 z-30"
        >
          <button
            type="button"
            id="workspace-drawer-trigger-handle"
            onClick={() => setIsOpen(true)}
            onTouchStart={handlePeekTouchStart}
            onTouchEnd={handlePeekTouchEnd}
            className="w-full flex flex-col items-center justify-center py-1.5 hover:bg-muted/40 transition-colors cursor-pointer group active:scale-[0.99] outline-none focus-visible:ring-1 focus-visible:ring-primary pb-[max(0.375rem,env(safe-area-inset-bottom,0px))]"
            aria-label="Open workspace navigation drawer"
            aria-expanded={false}
            title="Open workspace switcher"
          >
            {/* Classic subtle grab notch pill */}
            <div className="w-10 h-1 rounded-full bg-muted-foreground/40 group-hover:bg-muted-foreground/75 transition-colors" />
          </button>
        </div>
      )}

      {/* Expanded Bottom-Up Drawer Modal Overlay & Container (z-50 backdrop, z-60 drawer) */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            id="workspace-drawer-backdrop"
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-150 motion-reduce:animate-none"
            onClick={() => setIsOpen(false)}
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
              className="pointer-events-auto w-full max-w-lg bg-background/95 backdrop-blur-xl border-t border-x border-border rounded-t-2xl shadow-2xl px-2 pt-1.5 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] select-none animate-in slide-in-from-bottom duration-200 ease-out motion-reduce:animate-none"
            >
            {/* Top Grab / Dismiss Handle */}
            <div
              id="workspace-drawer-dismiss-bar"
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center justify-center py-1 cursor-pointer group"
              title="Collapse drawer"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setIsOpen(false);
                }
              }}
              aria-label="Collapse workspace drawer"
            >
              <div className="w-10 h-1 rounded-full bg-muted-foreground/40 group-hover:bg-muted-foreground/70 transition-colors" />
            </div>

            {/* Workspaces horizontal layout matching original footer */}
            <div className="flex items-center justify-around max-w-lg mx-auto mt-0.5">
              {workspaces.map((ws) => {
                const Icon = ws.icon;
                const isActive = activeWorkspace === ws.id;

                return (
                  <button
                    key={ws.id}
                    id={`nav-workspace-${ws.id}`}
                    onClick={() => handleSelect(ws.id)}
                    className="flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-colors relative group cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    title={ws.tooltip}
                    aria-label={ws.label}
                  >
                    {/* Material You rounded pill highlight */}
                    <div
                      className={`flex items-center justify-center w-12 h-7 rounded-full transition-colors duration-200 ${
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
                      className={`text-[10px] mt-0.5 tracking-tight transition-colors ${
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
