import React from "react";
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
  SpeechSettings,
  ChatSessionItem,
} from "../types";

export interface SharedWorkspaceProps {
  config: PromptConfig;
  onUpdateSystemInstruction: (inst: string) => void;
  onOpenParameters: () => void;
  hasApiKey: boolean;
  onOpenAuth: () => void;
  onOpenSettings: (tab: "account" | "display" | "security") => void;
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
  onSelectSession: (s: Partial<ChatSessionItem>) => void;
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
  julesMessages: ChatMessage[];
  onSendJulesMessage: (text: string, attachments?: MessageAttachment[], templateIds?: string[], rawUserText?: string) => Promise<boolean | void> | void;
  onClearJulesMessages: () => void;
  onStopJulesPolling: () => void;
  isJulesExecuting: boolean;
  hasJulesApiKey: boolean;
  onSelectJulesSession: (s: Partial<JulesSession>) => void;
}

export interface WorkspaceRouterProps extends ChatWorkspaceProps, IDEWorkspaceProps, JulesWorkspaceProps {
  promptType: PromptType;
}

export const WorkspaceRouter: React.FC<WorkspaceRouterProps> = ({
  promptType,
  messages,
  onSendMessage,
  onClearMessages,
  onRegenerate,
  onStopGeneration,
  isGenerating,
  config,
  onUpdateSystemInstruction,
  onOpenParameters,
  hasApiKey,
  onOpenAuth,
  speechSettings,
  onSaveSpeechSettings,
  onOpenSettings,
  activeProjectId,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onOpenBottomNav,
  isTemplateDrawerOpen,
  onOpenTemplateDrawer,
  onCloseTemplateDrawer,
  selectedTemplateIds,
  onToggleTemplate,
  onRemoveTemplate,
  onClearAllTemplates,
  freeformText,
  structuredExamples,
  onSwitchToPrompt,
  activeJulesSession,
  onOpenJulesSessions,
  onApproveJulesPlan,
  onRejectJulesPlan,
  isApprovingJulesPlan,
  julesMessages,
  onSendJulesMessage,
  onClearJulesMessages,
  onStopJulesPolling,
  isJulesExecuting,
  hasJulesApiKey,
  onSelectJulesSession,
}) => {
  return (
    <main className="flex-1 flex flex-col overflow-hidden relative">
      {promptType === "chat" && (
        <ChatWorkspace
          messages={messages}
          onSendMessage={onSendMessage}
          onClearMessages={onClearMessages}
          onRegenerate={onRegenerate}
          onStopGeneration={onStopGeneration}
          isGenerating={isGenerating}
          config={config}
          onUpdateSystemInstruction={onUpdateSystemInstruction}
          onOpenParameters={onOpenParameters}
          hasApiKey={hasApiKey}
          onOpenAuth={onOpenAuth}
          speechSettings={speechSettings}
          onSaveSpeechSettings={onSaveSpeechSettings}
          onOpenSettings={onOpenSettings}
          activeProjectId={activeProjectId}
          currentSessionId={currentSessionId}
          onSelectSession={onSelectSession}
          onNewChat={onNewChat}
          onOpenBottomNav={onOpenBottomNav}
          isTemplateDrawerOpen={isTemplateDrawerOpen}
          onOpenTemplateDrawer={onOpenTemplateDrawer}
          onCloseTemplateDrawer={onCloseTemplateDrawer}
          selectedTemplateIds={selectedTemplateIds}
          onToggleTemplate={onToggleTemplate}
          onRemoveTemplate={onRemoveTemplate}
          onClearAllTemplates={onClearAllTemplates}
        />
      )}
      {promptType === "code" && (
        <MobileIDEWorkspace
          config={config}
          messages={messages}
          freeformText={freeformText}
          structuredExamples={structuredExamples}
          hasApiKey={hasApiKey}
          onOpenAuth={onOpenAuth}
          onSwitchToPrompt={onSwitchToPrompt}
          onOpenParameters={onOpenParameters}
        />
      )}
      {promptType === "jules" && (
        <ChatWorkspace
          isJulesMode={true}
          activeJulesSession={activeJulesSession}
          onOpenJulesSessions={onOpenJulesSessions}
          onApproveJulesPlan={onApproveJulesPlan}
          onRejectJulesPlan={onRejectJulesPlan}
          isApprovingJulesPlan={isApprovingJulesPlan}
          messages={julesMessages}
          onSendMessage={async (text, attachments, templateIds, rawUserText) => {
            if (!hasJulesApiKey) {
               onOpenAuth();
               return;
            }
            const result = await onSendJulesMessage(text, attachments, templateIds, rawUserText);
            if (result === false) {
               onOpenJulesSessions();
            }
          }}
          onClearMessages={onClearJulesMessages}
          onRegenerate={() => {}}
          onStopGeneration={onStopJulesPolling}
          isGenerating={isJulesExecuting}
          config={config}
          onUpdateSystemInstruction={onUpdateSystemInstruction}
          onOpenParameters={onOpenParameters}
          hasApiKey={hasJulesApiKey}
          onOpenAuth={onOpenAuth}
          speechSettings={speechSettings}
          onSaveSpeechSettings={onSaveSpeechSettings}
          onOpenSettings={onOpenSettings}
          activeProjectId={activeProjectId}
          currentSessionId={activeJulesSession?.id}
          onSelectSession={onSelectJulesSession}
          onNewChat={onOpenJulesSessions}
          onOpenBottomNav={onOpenBottomNav}
          isTemplateDrawerOpen={isTemplateDrawerOpen}
          onOpenTemplateDrawer={onOpenTemplateDrawer}
          onCloseTemplateDrawer={onCloseTemplateDrawer}
          selectedTemplateIds={selectedTemplateIds}
          onToggleTemplate={onToggleTemplate}
          onRemoveTemplate={onRemoveTemplate}
          onClearAllTemplates={onClearAllTemplates}
        />
      )}
      {promptType === "stubs" && (
        <StubsWorkspace
          onOpenBottomNav={onOpenBottomNav}
          onOpenParameters={onOpenParameters}
        />
      )}
    </main>
  );
};
