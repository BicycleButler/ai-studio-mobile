import React from "react";
import { ProjectInfo } from "../../types";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";
import { GoogleAuthCard } from "../GoogleAuthCard";
import { useServices } from "../../services/ServiceContext";
import { ServerConfigSection } from "./ServerConfigSection";
import { AIStudioKeySection } from "./AIStudioKeySection";
import { JulesKeySection } from "./JulesKeySection";
import { ActiveProjectsSection } from "./ActiveProjectsSection";

export interface SettingsAccountTabProps {
  customApiKey: string;
  hasServerKey: boolean;
  onRefreshServerAuth?: () => void;
  onOpenCustomTabBrowser: (service: "aistudio" | "jules") => void;
  isVerifyingKey: boolean;
  localKeyValidationResult: { valid: boolean; error?: string; verifiedAt?: number } | null;
  julesApiKey: string;
  isVerifyingJulesKey: boolean;
  julesKeyValidationResult: { valid: boolean; error?: string; verifiedAt?: number } | null;
  activeProject: ProjectInfo | null;
  projects: ProjectInfo[];
  onOpenImportProject: () => void;
  onSelectProject: (p: ProjectInfo) => void;
  onRenameProject: (p: ProjectInfo) => void;
  onDeleteProject: (p: ProjectInfo) => void;
  onBulkDeleteProjects?: (ids: string[]) => void;
  selectedProjectIds?: Set<string>;
  toggleProjectSelection?: (id: string, e: React.MouseEvent | React.KeyboardEvent, index: number, filteredIds?: string[]) => void;
  toggleSelectAllProjects?: () => void;
  clearProjectSelection?: () => void;
  getProjectSelectionState?: () => 'none' | 'some' | 'all';
  handleBulkDeleteProjects?: () => void;
  liveModelsCount: number;
}

export const SettingsAccountTab: React.FC<SettingsAccountTabProps> = ({
  customApiKey,
  hasServerKey,
  onRefreshServerAuth,
  onOpenCustomTabBrowser,
  isVerifyingKey,
  localKeyValidationResult,
  julesApiKey,
  isVerifyingJulesKey,
  julesKeyValidationResult,
  activeProject,
  projects,
  onOpenImportProject,
  onSelectProject,
  onRenameProject,
  onDeleteProject,
  liveModelsCount,
  selectedProjectIds,
  toggleProjectSelection,
  toggleSelectAllProjects,
  clearProjectSelection,
  getProjectSelectionState,
  handleBulkDeleteProjects,
}) => {
  const offlineQueue = useOfflineQueue();
  const { timeProvider } = useServices();
  const pendingProjectIds = new Set(
    offlineQueue.filter(m => m.type === "projects").flatMap(m => {
      if (typeof m.payload === "object" && m.payload !== null && "projects" in m.payload && Array.isArray((m.payload as Record<string, unknown>).projects)) {
          return ((m.payload as Record<string, unknown>).projects as Record<string, unknown>[]).map(p => p.id as string);
      }
      return [];
    })
  );

  return (
    <div className="space-y-4">
      <GoogleAuthCard liveModelsCount={liveModelsCount} />

      <ServerConfigSection
        hasServerKey={hasServerKey}
        onRefreshServerAuth={onRefreshServerAuth}
      />

      <AIStudioKeySection
        customApiKey={customApiKey}
        isVerifyingKey={isVerifyingKey}
        localKeyValidationResult={localKeyValidationResult}
        onOpenCustomTabBrowser={onOpenCustomTabBrowser}
        onOpenImportProject={onOpenImportProject}
      />

      <JulesKeySection
        julesApiKey={julesApiKey}
        isVerifyingJulesKey={isVerifyingJulesKey}
        julesKeyValidationResult={julesKeyValidationResult}
        onOpenCustomTabBrowser={onOpenCustomTabBrowser}
      />

      <ActiveProjectsSection
        projects={projects}
        activeProject={activeProject}
        pendingProjectIds={pendingProjectIds}
        timeProvider={timeProvider}
        onOpenImportProject={onOpenImportProject}
        onSelectProject={onSelectProject}
        onRenameProject={onRenameProject}
        onDeleteProject={onDeleteProject}
        selectedProjectIds={selectedProjectIds}
        toggleProjectSelection={toggleProjectSelection}
        toggleSelectAllProjects={toggleSelectAllProjects}
        clearProjectSelection={clearProjectSelection}
        getProjectSelectionState={getProjectSelectionState}
        handleBulkDeleteProjects={handleBulkDeleteProjects}
      />
    </div>
  );
};
