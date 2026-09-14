import React from "react";
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

  return (
    <nav
      id="android-bottom-nav"
      className="sticky bottom-0 z-30 bg-background/95 backdrop-blur-lg border-t border-border px-1.5 py-1 shrink-0 select-none"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {workspaces.map((ws) => {
          const Icon = ws.icon;
          const isActive = activeWorkspace === ws.id;

          return (
            <button
              key={ws.id}
              id={`nav-workspace-${ws.id}`}
              onClick={() => onSelectWorkspace(ws.id)}
              className="flex flex-col items-center justify-center py-0.5 px-2 rounded-xl transition-colors relative group cursor-pointer"
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
  );
};
