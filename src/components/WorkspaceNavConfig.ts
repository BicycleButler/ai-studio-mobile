import { MessageSquare, Code2, Ticket } from "lucide-react";
import { PromptType } from "../types";

export interface WorkspaceItem {
  id: PromptType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tooltip: string;
}

export const WORKSPACE_NAV_CONFIG: WorkspaceItem[] = [
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
    id: "stubs",
    label: "Stubs",
    icon: Ticket,
    tooltip: "Architecture-as-Code PWM Portal",
  },
];
