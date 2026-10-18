import { useBatchSelection } from "../useBatchSelection";
import { ProjectInfo } from "../../types";

export function useSettingsProjectsState(projects: ProjectInfo[], onBulkDeleteProjects?: (ids: string[]) => void, onDeleteProject?: (project: ProjectInfo) => void) {
  const {
    selectedIds: selectedProjectIds,
    showBulkDeleteConfirm: showBulkDeleteProjectsConfirm,
    setShowBulkDeleteConfirm: setShowBulkDeleteProjectsConfirm,
    bulkDeleteConfirmationText,
    setBulkDeleteConfirmationText,
    toggleSelection: toggleProjectSelection,
    toggleSelectAll: toggleSelectAllProjectsRaw,
    clearSelection: clearProjectSelection,
    handleBulkDelete: handleBulkDeleteProjects,
  } = useBatchSelection({
    items: projects,
    getItemId: (p) => p.id,
    onBulkDelete: onBulkDeleteProjects
      ? onBulkDeleteProjects
      : (ids) => {
          if (onDeleteProject) {
            ids.forEach((id) => {
              const project = projects.find((p) => p.id === id);
              if (project) onDeleteProject(project);
            });
          }
        },
  });

  return {
    selectedProjectIds,
    showBulkDeleteProjectsConfirm,
    setShowBulkDeleteProjectsConfirm,
    bulkDeleteConfirmationText,
    setBulkDeleteConfirmationText,
    toggleProjectSelection,
    toggleSelectAllProjectsRaw,
    clearProjectSelection,
    handleBulkDeleteProjects,
  };
}
