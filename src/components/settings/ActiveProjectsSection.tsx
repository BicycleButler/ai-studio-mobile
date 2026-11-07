import React from "react";
import { Folder, Clock, AlertCircle, Edit2, Trash2, Check } from "lucide-react";
import { ProjectInfo } from "../../types";
import { BatchSelectionHeader } from "../BatchSelectionHeader";
import { BatchDeleteOverlay } from "../BatchDeleteOverlay";
import { SettingsSectionCard } from "./SettingsSectionCard";
import { ITimeProvider } from "../../utils/timeProvider";

export interface ActiveProjectsSectionProps {
  projects: ProjectInfo[];
  activeProject: ProjectInfo | null;
  pendingProjectIds: Set<string>;
  timeProvider: ITimeProvider;
  onOpenImportProject: () => void;
  onSelectProject: (p: ProjectInfo) => void;
  onRenameProject: (p: ProjectInfo) => void;
  onDeleteProject: (p: ProjectInfo) => void;
  selectedProjectIds?: Set<string>;
  toggleProjectSelection?: (id: string, e: React.MouseEvent | React.KeyboardEvent, index: number, filteredIds?: string[]) => void;
  toggleSelectAllProjects?: () => void;
  clearProjectSelection?: () => void;
  getProjectSelectionState?: () => 'none' | 'some' | 'all';
  handleBulkDeleteProjects?: () => void;
}

export const ActiveProjectsSection: React.FC<ActiveProjectsSectionProps> = ({
  projects,
  activeProject,
  pendingProjectIds,
  timeProvider,
  onOpenImportProject,
  onSelectProject,
  onRenameProject,
  onDeleteProject,
  selectedProjectIds,
  toggleProjectSelection,
  toggleSelectAllProjects,
  clearProjectSelection,
  getProjectSelectionState,
  handleBulkDeleteProjects,
}) => {
  if (projects.length === 0 && !activeProject) {
    return null;
  }

  return (
    <>
      <SettingsSectionCard
        icon={<Folder className="w-5 h-5 text-blue-500" />}
        title={
          <div className="flex items-center justify-between w-full">
            <span>Active Projects</span>
            <button
              onClick={onOpenImportProject}
              className="text-[10px] uppercase font-bold tracking-wide text-blue-500 hover:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-1 rounded transition"
            >
              Import New
            </button>
          </div>
        }
        accentColorClass="bg-blue-500/5"
        iconBgClass="bg-blue-500/10"
        iconColorClass="text-blue-500"
      >
        {projects.length > 0 && toggleSelectAllProjects && (
          <BatchSelectionHeader
            selectedCount={selectedProjectIds?.size || 0}
            totalCount={projects.length}
            selectionState={getProjectSelectionState?.() || 'none'}
            onToggleSelectAll={toggleSelectAllProjects}
            className="!px-0 mb-2"
          />
        )}

        <div className="space-y-2">
          {projects.map((p, index) => {
            const isSelected = selectedProjectIds?.has(p.id);
            return (
              <div
                key={p.id}
                className={`p-3 rounded-lg border transition flex items-center justify-between ${
                  isSelected ? "bg-primary/5 border-primary/30" : activeProject?.id === p.id
                    ? "bg-blue-500/5 border-blue-500/30"
                    : "bg-muted/50 border-border/50 hover:border-border"
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => toggleProjectSelection && toggleProjectSelection(p.id, e, index, projects.map(proj => proj.id))}
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
                        {timeProvider.date(p.updatedAt).toLocaleDateString()}
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
                      className="p-1.5 text-muted-foreground hover:text-destructive-foreground hover:bg-destructive/90 rounded"
                      title="Delete project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SettingsSectionCard>

      <BatchDeleteOverlay
        isVisible={!!(selectedProjectIds && selectedProjectIds.size > 0)}
        selectedCount={selectedProjectIds?.size || 0}
        itemType="project"
        onClearSelection={() => clearProjectSelection && clearProjectSelection()}
        onDelete={() => handleBulkDeleteProjects && handleBulkDeleteProjects()}
      />
    </>
  );
};
