import React from "react";
import { ChatWorkspace } from "./ChatWorkspace";
import { MobileIDEWorkspace } from "./MobileIDEWorkspace";
import { StubsWorkspace } from "./StubsWorkspace";
import {
  PromptType,
  ChatMessage,
  StructuredExample,
  MessageAttachment,
  JulesSession,

  ChatSession,
} from "../types";

export interface ChatWorkspaceProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, atts?: MessageAttachment[], tplIds?: string[], rawText?: string) => Promise<void> | void;
  onClearMessages: () => void;
  onRegenerate: () => void;
  onStopGeneration: () => void;
  isGenerating: boolean;
  currentSessionId?: string;
  onSelectSession: (s: Partial<ChatSession>) => void;
  onNewChat: () => void;
}

export interface IDEWorkspaceProps {
  messages: ChatMessage[];
  freeformText?: string;
  structuredExamples?: StructuredExample[];
  onSwitchToPrompt: () => void;
}

export interface JulesWorkspaceProps {
  activeJulesSession: JulesSession | null;
  onOpenJulesSessions: () => void;
  onApproveJulesPlan: (taskId: string) => Promise<void> | void;
  onRejectJulesPlan: (taskId: string) => Promise<void> | void;
  isApprovingJulesPlan: boolean;
  messages: ChatMessage[];
  onSendMessage: (text: string, attachments?: MessageAttachment[], templateIds?: string[], rawUserText?: string) => Promise<boolean | void> | void;
  onClearMessages: () => void;
  onStopGeneration: () => void;
  isGenerating: boolean;
  hasJulesApiKey: boolean;
  onSelectJulesSession: (s: Partial<JulesSession>) => void;
  onRegenerate: () => void;
}

import { StubsWorkspaceProps } from "./StubsWorkspace";

export interface WorkspaceRouterProps {
  promptType: PromptType;
  chatProps: ChatWorkspaceProps;
  ideProps: IDEWorkspaceProps;
  julesProps: JulesWorkspaceProps;
  stubsProps?: StubsWorkspaceProps;
}

export const WorkspaceRouter: React.FC<WorkspaceRouterProps> = ({
  promptType,
  chatProps,
  ideProps,
  julesProps,
  stubsProps,
}) => {
  return (
    <main className="flex-1 flex flex-col overflow-hidden relative">
      {promptType === "chat" && (
        <ChatWorkspace {...chatProps} />
      )}
      {promptType === "code" && (
        <MobileIDEWorkspace {...ideProps} />
      )}
      {promptType === "jules" && (
        <ChatWorkspace isJulesMode={true} {...julesProps} />
      )}
      {promptType === "stubs" && (
        <StubsWorkspace {...(stubsProps as StubsWorkspaceProps)} />
      )}
    </main>
  );
};
