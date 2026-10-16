import fs from 'fs';

let content = fs.readFileSync('src/components/settings/SettingsAccountTab.tsx', 'utf-8');

const search = `      <GoogleAuthCard
        user={googleUser}
        onLogin={onGoogleLogin || (async () => {})}
        onLogout={onGoogleLogout || (async () => {})}
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
  setBulkDeleteConfirmationText={liveModelsCount}
      />`;

const replace = `      <GoogleAuthCard
        user={googleUser}
        onLogin={onGoogleLogin || (async () => {})}
        onLogout={onGoogleLogout || (async () => {})}
        liveModelsCount={liveModelsCount}
      />`;

content = content.replace(search, replace);
fs.writeFileSync('src/components/settings/SettingsAccountTab.tsx', content);
