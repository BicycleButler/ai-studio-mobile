import React, { useState, useEffect } from "react";
import { MessageSquare, Code2, Bot, Ticket } from "lucide-react";
import { PromptType } from "../types";

import { Drawer } from "./ui/Drawer";

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
}

import { useServices } from "../services/ServiceContext";
export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeWorkspace,
  onSelectWorkspace,
  isOpen: propIsOpen,
  onClose,
}) => {
  const { platformService } = useServices();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = propIsOpen !== undefined ? propIsOpen : internalIsOpen;

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

    const removeKey = platformService.addEventListener("keydown", handleKeyDown);
    return () => removeKey();
  }, [isOpen]);

  const handleSelect = (workspace: PromptType) => {
    onSelectWorkspace(workspace);
    handleClose();
  };

  return (
    <Drawer
      isOpen={isOpen || false}
      onClose={handleClose}
      title="Workspaces"
      drawerId="bottom-nav-drawer"
      className="!px-2 !pt-1.5 !pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] select-none"
    >
      <nav role="navigation" aria-label="Workspace navigation" aria-expanded={true}>
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
                className="flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-colors relative group cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-12"
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
    </Drawer>
  );
};
