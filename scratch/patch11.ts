import fs from 'fs';

let content = fs.readFileSync('src/components/settings/SettingsAccountTab.tsx', 'utf-8');

const search = `  onDeleteProject,
  liveModelsCount,
  onBulkDeleteProjects,
  selectedProjectIds,
  toggleProjectSelection,
  toggleSelectAllProjects,
  clearProjectSelection,
  handleBulkDeleteProjects,
  showBulkDeleteProjectsConfirm,
  setShowBulkDeleteProjectsConfirm,
  bulkDeleteConfirmationText,
  setBulkDeleteConfirmationText
}) => {`;

const replace = `  onDeleteProject,
  liveModelsCount,
  // onBulkDeleteProjects, // keep it but don't use
  selectedProjectIds,
  toggleProjectSelection,
  toggleSelectAllProjects,
  clearProjectSelection,
  handleBulkDeleteProjects,
  showBulkDeleteProjectsConfirm,
  setShowBulkDeleteProjectsConfirm,
  bulkDeleteConfirmationText,
  setBulkDeleteConfirmationText
}) => {`;

content = content.replace(search, replace);
fs.writeFileSync('src/components/settings/SettingsAccountTab.tsx', content);
