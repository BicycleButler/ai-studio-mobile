const fs = require('fs');

let content = fs.readFileSync('src/components/UnifiedSettingsModal.tsx', 'utf8');

content = content.replace(
  /clearProjectSelection,\n\s*handleBulkDeleteProjects,\n\s*} = useSettingsProjectsState\(/g,
  `clearProjectSelection,\n    handleBulkDeleteProjects,\n    getProjectSelectionState,\n  } = useSettingsProjectsState(`
);

content = content.replace(
  /toggleSelectAllProjects={toggleSelectAllProjects}\n\s*clearProjectSelection={clearProjectSelection}/g,
  `toggleSelectAllProjects={toggleSelectAllProjects}\n              clearProjectSelection={clearProjectSelection}\n              getProjectSelectionState={getProjectSelectionState}`
);


fs.writeFileSync('src/components/UnifiedSettingsModal.tsx', content, 'utf8');
