import { useBatchSelection } from "../useBatchSelection";
import { ProjectInfo } from "../../types";

export function useSettingsProjectsState(projects: ProjectInfo[], activeTab: string, onBulkDeleteProjects?: (ids: string[]) => void, onDeleteProject?: (id: string) => void) {
  const {
    selectedIds: selectedProjectIds,
    toggleSelection: toggleProjectSelection,
    toggleSelectAll: toggleSelectAllProjectsRaw,
    clearSelection: clearProjectSelection,
    getSelectionState: getProjectSelectionState,
  } = useBatchSelection({
    items: projects,
    getItemId: (p) => p.id,
    clearOnDependencies: [activeTab],
    isActive: activeTab === "account",
    enableShortcuts: true
  });

  const handleBulkDeleteProjects = () => {
    const ids = Array.from(selectedProjectIds);
    if (onBulkDeleteProjects) {
      onBulkDeleteProjects(ids);
    } else if (onDeleteProject) {
      ids.forEach((id) => {
        const project = projects.find((p) => p.id === id);
        if (project) onDeleteProject(project.id);
      });
    }
    clearProjectSelection();
  };

  return {
    selectedProjectIds,
    toggleProjectSelection,
    toggleSelectAllProjectsRaw,
    clearProjectSelection,
    handleBulkDeleteProjects,
    getProjectSelectionState,
  };
}
