import React from "react";
import { ChatWorkspace } from "./ChatWorkspace";
import { MobileIDEWorkspace } from "./MobileIDEWorkspace";
import { StubsWorkspace } from "./StubsWorkspace";
import {
  PromptType,
  ChatMessage,
  StructuredExample,
  MessageAttachment,
  ChatSession,
} from "../types";
import { RemoteFileSource } from "../types/integrations";

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

export interface IDEOpenedFile {
  path: string;
  name: string;
  language: string;
  content: string;
  originalContent: string;
  remoteSource?: RemoteFileSource;
}

export interface IDEWorkspaceProps {
  messages: ChatMessage[];
  freeformText?: string;
  structuredExamples?: StructuredExample[];
  onSwitchToPrompt: () => void;
  openedWorkspaceFiles?: IDEOpenedFile[];
  activeWorkspaceFilePath?: string | null;
  isLoadingWorkspaceFile?: boolean;
  workspaceFileError?: string | null;
  onSelectWorkspaceFile?: (path: string | null) => void;
  onOpenWorkspaceFile?: (path: string) => void;
  onUpdateWorkspaceFileContent?: (path: string, content: string) => void;
  onResetWorkspaceFile?: (path: string) => void;
  onCloseWorkspaceFile?: (path: string) => void;
  onOpenRemoteFileInIDE?: (file: {
    path: string;
    name: string;
    language: string;
    content: string;
    remoteSource: RemoteFileSource;
  }) => void;
  onUpdateRemoteSource?: (filePath: string, remoteSource: RemoteFileSource, syncedContent: string) => void;
}

import { StubsWorkspaceProps } from "./StubsWorkspace";
import { ErrorBoundary } from "./ErrorBoundary";

export interface WorkspaceRouterProps {
  promptType: PromptType;
  chatProps: ChatWorkspaceProps;
  ideProps: IDEWorkspaceProps;
  stubsProps?: StubsWorkspaceProps;
}

export const WorkspaceRouter: React.FC<WorkspaceRouterProps> = ({
  promptType,
  chatProps,
  ideProps,
  stubsProps,
}) => {
  return (
    <main className="flex-1 flex flex-col overflow-hidden relative">
      {promptType === "chat" && (
        <ErrorBoundary scope="chat" key="chat">
          <ChatWorkspace {...chatProps} />
        </ErrorBoundary>
      )}
      {promptType === "code" && (
        <ErrorBoundary scope="code" key="code">
          <MobileIDEWorkspace {...ideProps} />
        </ErrorBoundary>
      )}
      {promptType === "stubs" && (
        <ErrorBoundary scope="stubs" key="stubs">
          <StubsWorkspace {...(stubsProps as StubsWorkspaceProps)} />
        </ErrorBoundary>
      )}
    </main>
  );
};
