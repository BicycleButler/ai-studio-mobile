import React, { createContext, useContext, ReactNode } from "react";
import { LocalModelLoadProgress, ModelInfo, PromptConfig, SettingsTab } from "../types";
import { SpeechSettings } from "../services/speechVoices";

export interface SharedWorkspaceProps {
  config: PromptConfig;
  activeModelInfo?: ModelInfo;
  webllmProgress?: LocalModelLoadProgress;
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

  // Cross-workspace IDE navigation
  onOpenFileInIDE?: (filePath: string) => void;

  // Speech Settings
  speechSettings: SpeechSettings;
  onSaveSpeechSettings: (newSettings: SpeechSettings) => void;
}

const WorkspaceContext = createContext<SharedWorkspaceProps | undefined>(undefined);

export function WorkspaceProvider({ children, value }: { children: ReactNode; value: SharedWorkspaceProps }) {
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): SharedWorkspaceProps {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
