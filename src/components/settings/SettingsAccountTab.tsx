import React from "react";
import { Cpu, Blocks, ArrowRight } from "lucide-react";
import { ProjectInfo } from "../../types";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";
import { GoogleAuthCard } from "../GoogleAuthCard";
import { useServices } from "../../services/ServiceContext";
import { useProviderConnections } from "../../hooks/useProviderConnections";
import { useIntegrations } from "../../hooks/useIntegrations";
import { isLocalProvider } from "../../utils/providerCatalog";
import { ServerConfigSection } from "./ServerConfigSection";
import { AIStudioKeySection } from "./AIStudioKeySection";
import { ActiveProjectsSection } from "./ActiveProjectsSection";
import { SettingsSectionCard } from "./SettingsSectionCard";

export interface SettingsAccountTabProps {
  customApiKey: string;
  hasServerKey: boolean;
  onRefreshServerAuth?: () => void;
  onOpenCustomTabBrowser: () => void;
  onOpenProvidersTab?: () => void;
  onOpenIntegrationsTab?: () => void;
  isVerifyingKey: boolean;
  localKeyValidationResult: { valid: boolean; error?: string; verifiedAt?: number } | null;
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
  onOpenProvidersTab,
  onOpenIntegrationsTab,
  isVerifyingKey,
  localKeyValidationResult,
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
  const { connections, enabledModels } = useProviderConnections();
  const { enabledConnections: enabledIntegrations } = useIntegrations();
  const enabledCloudCount = connections.filter((c) => c.enabled && !isLocalProvider(c.providerId)).length;
  const enabledLocalCount = connections.filter((c) => c.enabled && isLocalProvider(c.providerId)).length;

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

      {onOpenProvidersTab && (
        <SettingsSectionCard
          icon={<Cpu className="w-5 h-5 text-primary" />}
          title="Other Providers &amp; Local On-Device Models"
          description="Connect API keys for OpenAI, Anthropic, OpenRouter, Groq, or run offline WebGPU &amp; Ollama models."
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
              <span className="tabular-nums font-medium text-foreground">
                {enabledCloudCount} external
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums font-medium text-foreground">
                {enabledLocalCount} local
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {enabledModels.length} active models
              </span>
            </div>
            <button
              type="button"
              id="account-open-providers-btn"
              onClick={onOpenProvidersTab}
              className="px-3.5 py-2 rounded-xl bg-muted hover:bg-primary hover:text-primary-foreground text-foreground text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Manage Providers</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </button>
          </div>
        </SettingsSectionCard>
      )}

      {onOpenIntegrationsTab && (
        <SettingsSectionCard
          icon={<Blocks className="w-5 h-5 text-primary" />}
          title="Firebase, Google Cloud, GitHub &amp; Vercel"
          description="Connect your own cloud and repository projects for bi-directional file editing, Firestore writes, GCS uploads, and deployments."
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
              <span className="tabular-nums font-medium text-foreground">
                {enabledIntegrations.length} connected
              </span>
              <span aria-hidden="true">·</span>
              <span>Bi-directional read &amp; write</span>
            </div>
            <button
              type="button"
              id="account-open-integrations-btn"
              onClick={onOpenIntegrationsTab}
              className="px-3.5 py-2 rounded-xl bg-muted hover:bg-primary hover:text-primary-foreground text-foreground text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Manage Integrations</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </button>
          </div>
        </SettingsSectionCard>
      )}

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
