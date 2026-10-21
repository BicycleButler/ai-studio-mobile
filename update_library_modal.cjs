const fs = require('fs');
let content = fs.readFileSync('src/components/LibraryModal.tsx', 'utf8');

content = content.replace(
  /const {\n\s*selectedIds: selectedPromptIds,\n\s*toggleSelection,\n\s*toggleSelectAll,\n\s*clearSelection,\n\s*removeFromSelection,\n\s*} = useBatchSelection\(\{/g,
  `const {\n    selectedIds: selectedPromptIds,\n    toggleSelection,\n    toggleSelectAll,\n    clearSelection,\n    removeFromSelection,\n    getSelectionState,\n  } = useBatchSelection({`
);


content = content.replace(
  /\{selectedPromptIds\.size === savedPrompts\.length \? \(\n\s*<CheckSquare className="w-4 h-4 text-primary" \/>\n\s*\) : selectedPromptIds\.size > 0 \? \(\n\s*<CheckSquare className="w-4 h-4 text-primary opacity-50" \/>\n\s*\) : \(\n\s*<Square className="w-4 h-4" \/>\n\s*\)\}/g,
  `{getSelectionState(savedPrompts) === 'all' ? (
                  <CheckSquare className="w-4 h-4 text-primary" />
                ) : getSelectionState(savedPrompts) === 'some' ? (
                  <MinusSquare className="w-4 h-4 text-primary" />
                ) : (
                  <Square className="w-4 h-4" />
                )}`
);

content = content.replace(
  /import \{ X, Search, Clock, Save, Trash2, CheckSquare, Square, FolderOpen \} from "lucide-react";/g,
  `import { X, Search, Clock, Save, Trash2, CheckSquare, Square, MinusSquare, FolderOpen } from "lucide-react";`
);

fs.writeFileSync('src/components/LibraryModal.tsx', content, 'utf8');
