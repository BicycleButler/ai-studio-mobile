import React from "react";
import { SettingsTab } from "../types";
import { SpeechSettings } from "../services/speechVoices";
import { ChatWorkspace } from "./ChatWorkspace";
import { MobileIDEWorkspace } from "./MobileIDEWorkspace";
import { StubsWorkspace } from "./StubsWorkspace";
import {
  PromptType,
  ChatMessage,
  PromptConfig,
  StructuredExample,
  MessageAttachment,
  JulesSession,

  ChatSession,
} from "../types";

export interface SharedWorkspaceProps {
  config: PromptConfig;
  onUpdateSystemInstruction: (inst: string) => void;
  onOpenParameters: () => void;
  hasApiKey: boolean;
  onOpenAuth: () => void;
  onOpenSettings: (tab?: SettingsTab) => void;
  activeProjectId?: string;
  onOpenBottomNav: () => void;

  // Template props
  isTemplateDrawerOpen: boolean;
  onOpenTemplateDrawer: () => void;
  onCloseTemplateDrawer: () => void;
  selectedTemplateIds: string[];
  onToggleTemplate: (id: string) => void;
  onRemoveTemplate: (id: string) => void;
  onClearAllTemplates: () => void;

  // Speech Settings
  speechSettings: SpeechSettings;
  onSaveSpeechSettings: (newSettings: SpeechSettings) => void;
}

export interface ChatWorkspaceProps extends SharedWorkspaceProps {
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

export interface IDEWorkspaceProps extends SharedWorkspaceProps {
  messages: ChatMessage[];
  freeformText?: string;
  structuredExamples?: StructuredExample[];
  onSwitchToPrompt: () => void;
}

export interface JulesWorkspaceProps extends SharedWorkspaceProps {
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
  sharedProps: SharedWorkspaceProps;
  chatProps: Omit<ChatWorkspaceProps, keyof SharedWorkspaceProps>;
  ideProps: Omit<IDEWorkspaceProps, keyof SharedWorkspaceProps>;
  julesProps: Omit<JulesWorkspaceProps, keyof SharedWorkspaceProps>;
  stubsProps?: StubsWorkspaceProps;
}

export const WorkspaceRouter: React.FC<WorkspaceRouterProps> = ({
  promptType,
  sharedProps,
  chatProps,
  ideProps,
  julesProps,
  stubsProps,
}) => {
  return (
    <main className="flex-1 flex flex-col overflow-hidden relative">
      {promptType === "chat" && (
        <ChatWorkspace {...sharedProps} {...chatProps} />
      )}
      {promptType === "code" && (
        <MobileIDEWorkspace {...sharedProps} {...ideProps} />
      )}
      {promptType === "jules" && (
        <ChatWorkspace isJulesMode={true} {...sharedProps} {...julesProps} />
      )}
      {promptType === "stubs" && (
        <StubsWorkspace {...stubsProps} />
      )}
    </main>
  );
};
