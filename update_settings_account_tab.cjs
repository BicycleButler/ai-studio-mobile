const fs = require('fs');

let content = fs.readFileSync('src/components/settings/SettingsAccountTab.tsx', 'utf8');

content = content.replace(
  /toggleSelectAllProjects\?: \(\) => void;\n\s*clearProjectSelection\?: \(\) => void;/g,
  `toggleSelectAllProjects?: () => void;\n  clearProjectSelection?: () => void;\n  getProjectSelectionState?: (items?: ProjectInfo[]) => 'none' | 'some' | 'all';`
);

content = content.replace(
  /toggleSelectAllProjects,\n\s*clearProjectSelection,/g,
  `toggleSelectAllProjects,\n  clearProjectSelection,\n  getProjectSelectionState,`
);

content = content.replace(
  /\{selectedProjectIds\?\.size === projects\.length \? \(\n\s*<Check className="w-4 h-4 text-primary" \/>\n\s*\) : selectedProjectIds\?\.size && selectedProjectIds\.size > 0 \? \(\n\s*<Check className="w-4 h-4 text-primary" \/>\n\s*\) : \(\n\s*<Check className="w-4 h-4 opacity-50" \/>\n\s*\)\}/g,
  `{getProjectSelectionState?.(projects) === 'all' ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : getProjectSelectionState?.(projects) === 'some' ? (
                        <MinusSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}`
);

content = content.replace(
  /import \{ FolderGit2, Trash2, Check, RefreshCw, Smartphone, Key, Settings, Cpu \} from "lucide-react";/g,
  `import { FolderGit2, Trash2, Check, RefreshCw, Smartphone, Key, Settings, Cpu, CheckSquare, MinusSquare, Square } from "lucide-react";`
);

content = content.replace(
  /\{isSelected \? \(\n\s*<Check className="w-4 h-4 text-primary" \/>\n\s*\) : \(\n\s*<Check className="w-4 h-4 text-muted-foreground opacity-30" \/>\n\s*\)\}/g,
  `{isSelected ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}`
);



fs.writeFileSync('src/components/settings/SettingsAccountTab.tsx', content, 'utf8');
