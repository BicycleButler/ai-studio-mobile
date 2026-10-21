const fs = require('fs');

let content = fs.readFileSync('src/components/JulesSessionDrawer.tsx', 'utf8');

content = content.replace(
  /const {\n\s*selectedIds: selectedSessionIds,\n\s*toggleSelection,\n\s*toggleSelectAll,\n\s*clearSelection,\n\s*removeFromSelection,\n\s*} = useBatchSelection\(\{/g,
  `const {\n    selectedIds: selectedSessionIds,\n    toggleSelection,\n    toggleSelectAll,\n    clearSelection,\n    removeFromSelection,\n    getSelectionState,\n  } = useBatchSelection({`
);

content = content.replace(
  /<button\n\s*type="button"\n\s*onClick={\(\) => toggleSelectAll\(filteredSessions\)}\n\s*className="shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"\n\s*aria-label="Select all sessions"\n\s*>\n\s*\{selectedSessionIds.size === filteredSessions.length && filteredSessions.length > 0 \? \(\n\s*<CheckSquare className="w-4 h-4 text-primary" \/>\n\s*\) : \(\n\s*<Square className="w-4 h-4" \/>\n\s*\)\}\n\s*<\/button>/g,
  `<button
                type="button"
                onClick={() => toggleSelectAll(filteredSessions)}
                className="shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Select all sessions on this page"
              >
                {getSelectionState(filteredSessions) === 'all' ? (
                  <CheckSquare className="w-4 h-4 text-primary" />
                ) : getSelectionState(filteredSessions) === 'some' ? (
                  <MinusSquare className="w-4 h-4 text-primary" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
              </button>`
);

fs.writeFileSync('src/components/JulesSessionDrawer.tsx', content, 'utf8');
