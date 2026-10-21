import { useBatchSelection } from "../useBatchSelection";
import { useBulkActionConfirm } from "../useBulkActionConfirm";
import { ProjectInfo } from "../../types";

export function useSettingsProjectsState(projects: ProjectInfo[], onBulkDeleteProjects?: (ids: string[]) => void, onDeleteProject?: (project: ProjectInfo) => void) {
  const {
    selectedIds: selectedProjectIds,
    toggleSelection: toggleProjectSelection,
    toggleSelectAll: toggleSelectAllProjectsRaw,
    clearSelection: clearProjectSelection,
    getSelectionState: getProjectSelectionState,
  } = useBatchSelection({
    items: projects,
    getItemId: (p) => p.id,
  });

  const {
    showBulkDeleteConfirm: showBulkDeleteProjectsConfirm,
    setShowBulkDeleteConfirm: setShowBulkDeleteProjectsConfirm,
    bulkDeleteConfirmationText,
    setBulkDeleteConfirmationText,
    handleBulkDelete: handleBulkDeleteProjects,
  } = useBulkActionConfirm({
    onConfirm: () => {
      const ids = Array.from(selectedProjectIds);
      if (onBulkDeleteProjects) {
        onBulkDeleteProjects(ids);
      } else if (onDeleteProject) {
        ids.forEach((id) => {
          const project = projects.find((p) => p.id === id);
          if (project) onDeleteProject(project);
        });
      }
    },
    onClearSelection: clearProjectSelection,
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
    getProjectSelectionState,
  };
}
