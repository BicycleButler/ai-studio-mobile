import React from "react";
import { ShieldCheck, CheckCircle2, Lock, Smartphone, ExternalLink, Bot, Check, FolderPlus, Folder, Trash2,
  Clock, Edit2, Loader2, AlertCircle, CheckSquare, MinusSquare, Square } from "lucide-react";
import { GoogleUser, ProjectInfo } from "../../types";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";
import { GoogleAuthCard } from "../GoogleAuthCard";
import { DatasetScopeBanner } from "../DatasetScopeBanner";
import { FloatingBatchActionBar } from "../FloatingBatchActionBar";
import { BulkDeleteConfirmModal } from "../BulkDeleteConfirmModal";

export interface SettingsAccountTabProps {
  customApiKey: string;
  hasServerKey: boolean;
  googleUser: GoogleUser | null;
  onGoogleLogin?: () => Promise<void>;
  onGoogleLogout?: () => Promise<void>;
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
  toggleProjectSelection?: (id: string, e: React.MouseEvent | React.KeyboardEvent, index: number, filteredList?: ProjectInfo[]) => void;
  toggleSelectAllProjects?: () => void;
  clearProjectSelection?: () => void;
  getProjectSelectionState?: (items?: ProjectInfo[]) => 'none' | 'some' | 'all';
  handleBulkDeleteProjects?: () => void;
  showBulkDeleteProjectsConfirm?: boolean;
  setShowBulkDeleteProjectsConfirm?: (show: boolean) => void;
  bulkDeleteConfirmationText?: string;
  setBulkDeleteConfirmationText?: (text: string) => void;
  liveModelsCount: number;
}

export const SettingsAccountTab: React.FC<SettingsAccountTabProps> = ({
  customApiKey,
  hasServerKey,
  googleUser,
  onGoogleLogin,
  onGoogleLogout,
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
  // onBulkDeleteProjects, // keep it but don't use
  selectedProjectIds,
  toggleProjectSelection,
  toggleSelectAllProjects,
  clearProjectSelection,
  getProjectSelectionState,
  handleBulkDeleteProjects,
  showBulkDeleteProjectsConfirm,
  setShowBulkDeleteProjectsConfirm,
  bulkDeleteConfirmationText,
  setBulkDeleteConfirmationText
}) => {

  const offlineQueue = useOfflineQueue();
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
      <GoogleAuthCard
        user={googleUser}
        onLogin={onGoogleLogin || (async () => {})}
        onLogout={onGoogleLogout || (async () => {})}
        liveModelsCount={liveModelsCount}
      />

      <div
        className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
          hasServerKey
            ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
            : "bg-card border-border text-muted-foreground"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-lg ${
              hasServerKey
                ? "bg-muted"
                : "bg-muted"
            }`}
          >
            {hasServerKey ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            ) : (
              <Lock className="w-5 h-5" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-medium text-foreground">
              Server Environment Config
            </h4>
            <p className="text-xs mt-1 text-muted-foreground/80 leading-relaxed">
              {hasServerKey
                ? "Connected securely to self-hosted server."
                : "Server keys missing. Running in local mode."}
            </p>
          </div>
        </div>
        {hasServerKey ? (
          <div className="px-2.5 py-1 rounded bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Verified
          </div>
        ) : (
          <button
            onClick={onRefreshServerAuth}
            className="text-xs px-3 py-1.5 bg-muted hover:bg-muted-foreground/20 rounded-md transition-colors"
          >
            Refresh
          </button>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-4 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 end-0 w-32 h-32 bg-primary/5 rounded-bl-full pointer-events-none -me-4 -mt-4" />
        <div className="flex items-start gap-3 relative z-10">
          <div className="p-2 bg-primary/10 rounded-lg shrink-0">
            <Smartphone className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-foreground">
              Bring Your Own Device API Key
            </h4>
            <p className="text-xs text-muted-foreground mt-1 mb-4 leading-relaxed">
              Authenticate via the mobile app to securely store your Google AI Studio key on-device.
            </p>

            {customApiKey ? (
              <div className="bg-muted/50 rounded-lg p-3 border border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      <ShieldCheck className="w-3 h-3" /> Encrypted Key
                    </div>
                  </div>
                  {isVerifyingKey ? (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Verifying
                    </span>
                  ) : localKeyValidationResult ? (
                    localKeyValidationResult.valid ? (
                      <span className="text-[10px] text-foreground font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" /> Validated
                      </span>
                    ) : (
                      <span className="text-[10px] text-destructive font-medium flex items-center gap-1" title={localKeyValidationResult.error}>
                        <AlertCircle className="w-3 h-3" /> Invalid
                      </span>
                    )
                  ) : null}
                </div>
                <div className="font-mono text-xs text-foreground/80 break-all bg-background p-2 rounded-md border border-border/50">
                  {customApiKey.substring(0, 8)}...{customApiKey.substring(customApiKey.length - 4)}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => onOpenCustomTabBrowser("aistudio")}
                    className="flex-1 px-3 py-2 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium transition-colors"
                  >
                    Replace Key
                  </button>
                  <button
                    onClick={onOpenImportProject}
                    className="flex-1 px-3 py-2 rounded-md bg-muted hover:bg-muted-foreground/20 text-foreground text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    Load Project
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                id="link-aistudio-btn"
                onClick={() => onOpenCustomTabBrowser("aistudio")}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium py-2.5 px-4 rounded-xl transition-colors shadow-sm active:scale-[0.98]"
              >
                <span>Link AI Studio Account</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 end-0 w-32 h-32 bg-purple-500/5 rounded-bl-full pointer-events-none -me-4 -mt-4" />
        <div className="flex items-start gap-3 relative z-10">
          <div className="p-2 bg-purple-500/10 rounded-lg shrink-0">
            <Bot className="w-5 h-5 text-purple-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
              Jules Agent Key
              <span className="text-[9px] uppercase tracking-wider font-bold bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">Phase 2</span>
            </h4>
            <p className="text-xs text-muted-foreground mt-1 mb-4 leading-relaxed">
              Dedicated API key for the autonomous code-modifying agent. Required for filesystem access.
            </p>

            {julesApiKey ? (
              <div className="bg-muted/50 rounded-lg p-3 border border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-purple-500/20 text-purple-400 border border-purple-500/30">
                      <ShieldCheck className="w-3 h-3" /> Agent Key
                    </div>
                  </div>
                  {isVerifyingJulesKey ? (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Verifying
                    </span>
                  ) : julesKeyValidationResult ? (
                    julesKeyValidationResult.valid ? (
                      <span className="text-[10px] text-foreground font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" /> Validated
                      </span>
                    ) : (
                      <span className="text-[10px] text-destructive font-medium flex items-center gap-1" title={julesKeyValidationResult.error}>
                        <AlertCircle className="w-3 h-3" /> Invalid
                      </span>
                    )
                  ) : null}
                </div>
                <div className="font-mono text-xs text-foreground/80 break-all bg-background p-2 rounded-md border border-border/50">
                  {julesApiKey.substring(0, 8)}...{julesApiKey.substring(julesApiKey.length - 4)}
                </div>
                <div className="mt-3">
                  <button
                    onClick={() => onOpenCustomTabBrowser("jules")}
                    className="w-full px-3 py-2 rounded-md bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium transition-colors"
                  >
                    Replace Agent Key
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onOpenCustomTabBrowser("jules")}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium py-2.5 px-4 rounded-xl transition-colors shadow-sm active:scale-[0.98]"
              >
                <span>Authorize Jules Agent</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {(projects.length > 0 || activeProject) && (
        <div className="bg-card border border-border rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-start gap-3 relative z-10">
            <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
              <Folder className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-foreground">
                  Active Projects
                </h4>
                <button
                  onClick={onOpenImportProject}
                  className="text-[10px] uppercase font-bold tracking-wide text-blue-500 hover:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-1 rounded transition-colors"
                >
                  Import New
                </button>
              </div>

              {projects.length > 0 && toggleSelectAllProjects && (
                <div className="py-2 border-b border-border bg-muted/40 flex flex-col gap-2 text-xs mb-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleSelectAllProjects()}
                      className="text-muted-foreground hover:text-foreground cursor-pointer flex items-center"
                      aria-label="Select all projects on this page"
                    >
                      {getProjectSelectionState?.(projects) === 'all' ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : getProjectSelectionState?.(projects) === 'some' ? (
                        <MinusSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                    <span className="text-muted-foreground font-medium">
                      {selectedProjectIds?.size && selectedProjectIds.size > 0
                        ? `${selectedProjectIds.size} selected`
                        : "Select all on this page"}
                    </span>
                  </div>
                </div>
              )}

              {/* Dataset Scope Banner (ADR 0047) */}
              <DatasetScopeBanner selectedCount={selectedProjectIds?.size || 0} totalCount={projects.length} />

              <div className="space-y-2">
                {projects.map((p, index) => {
                  const isSelected = selectedProjectIds?.has(p.id);
                  return (
                  <div
                    key={p.id}
                    className={`p-3 rounded-lg border transition-colors flex items-center justify-between ${
                      isSelected ? "bg-primary/5 border-primary/30" : activeProject?.id === p.id
                        ? "bg-blue-500/5 border-blue-500/30"
                        : "bg-muted/50 border-border/50 hover:border-border"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => toggleProjectSelection && toggleProjectSelection(p.id, e, index)}
                      className="me-3 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                      aria-label={`Select project ${p.name}`}
                    >
                      {isSelected ? (
                        <Check className="w-4 h-4 text-primary" />
                      ) : (
                        <Check className="w-4 h-4 opacity-50" />
                      )}
                    </button>
                    <div className="flex items-center justify-between flex-1">
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => onSelectProject(p)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground truncate max-w-[140px] flex items-center gap-1">
                            <span className="truncate">{p.name}</span>
                            {pendingProjectIds.has(p.id) && (
                              <Clock className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" aria-label="Pending sync" />
                            )}
                          </span>
                          {activeProject?.id === p.id && (
                            <span className="text-[9px] bg-blue-500 text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2">
                          <span>
                            {new Date(p.updatedAt).toLocaleDateString()}
                          </span>
                          {p.status === "invalid_key" && (
                            <span className="text-muted-foreground font-medium flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Key Revoked
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onRenameProject(p)}
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                          title="Rename project"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteProject(p)}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"
                          title="Delete project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Batch Action Bar for Projects */}
      <FloatingBatchActionBar
        isVisible={!!(selectedProjectIds && selectedProjectIds.size > 0)}
        selectedCount={selectedProjectIds?.size || 0}
        actions={[
          {
            label: 'Delete',
            icon: <Trash2 />,
            onClick: () => setShowBulkDeleteProjectsConfirm && setShowBulkDeleteProjectsConfirm(true),
            variant: 'destructive'
          }
        ]}
        onClearSelection={() => clearProjectSelection && clearProjectSelection()}
      />

      <BulkDeleteConfirmModal
        isOpen={!!showBulkDeleteProjectsConfirm}
        onClose={() => {
          setShowBulkDeleteProjectsConfirm && setShowBulkDeleteProjectsConfirm(false);
          setBulkDeleteConfirmationText && setBulkDeleteConfirmationText("");
        }}
        onConfirm={() => handleBulkDeleteProjects && handleBulkDeleteProjects()}
        selectedCount={selectedProjectIds?.size || 0}
        itemType="project"
        confirmationText={bulkDeleteConfirmationText || ""}
        onConfirmationTextChange={(text) => setBulkDeleteConfirmationText && setBulkDeleteConfirmationText(text)}
      />
    </div>
  );
};