const fs = require('fs');

let content = fs.readFileSync('src/hooks/settings/useSettingsProjectsState.ts', 'utf8');

content = content.replace(
  /const {\n\s*selectedIds: selectedProjectIds,\n\s*toggleSelection: toggleProjectSelection,\n\s*toggleSelectAll: toggleSelectAllProjectsRaw,\n\s*clearSelection: clearProjectSelection,\n\s*} = useBatchSelection\(\{/g,
  `const {\n    selectedIds: selectedProjectIds,\n    toggleSelection: toggleProjectSelection,\n    toggleSelectAll: toggleSelectAllProjectsRaw,\n    clearSelection: clearProjectSelection,\n    getSelectionState: getProjectSelectionState,\n  } = useBatchSelection({`
);

content = content.replace(
  /clearProjectSelection,\n\s*handleBulkDeleteProjects,\n\s*};\n\s*}/g,
  `clearProjectSelection,\n    handleBulkDeleteProjects,\n    getProjectSelectionState,\n  };\n}`
);

fs.writeFileSync('src/hooks/settings/useSettingsProjectsState.ts', content, 'utf8');
