const fs = require('fs');
let content = fs.readFileSync('src/components/ChatWorkspace.tsx', 'utf8');

content = content.replace(
  /const {\n\s*selectedIds: selectedSessionIds,\n\s*toggleSelection,\n\s*toggleSelectAll,\n\s*clearSelection,\n\s*removeFromSelection,\n\s*} = useBatchSelection\(\{/g,
  `const {\n    selectedIds: selectedSessionIds,\n    toggleSelection,\n    toggleSelectAll,\n    clearSelection,\n    removeFromSelection,\n    getSelectionState,\n  } = useBatchSelection({`
);


content = content.replace(
  /\{selectedSessionIds\.size === filteredHistory\.length && filteredHistory\.length > 0 \? \(\n\s*<CheckSquare className="w-4 h-4 text-primary" \/>\n\s*\) : selectedSessionIds\.size > 0 \? \(\n\s*<CheckSquare className="w-4 h-4 text-primary opacity-50" \/>\n\s*\) : \(\n\s*<Square className="w-4 h-4" \/>\n\s*\)\}/g,
  `{getSelectionState(filteredHistory) === 'all' ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : getSelectionState(filteredHistory) === 'some' ? (
                        <MinusSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}`
);

content = content.replace(
  /import \{ Bot, MessageSquare, Send, StopCircle, RefreshCw, Paperclip, Plus, MoreVertical, X, Pencil, Check, Settings, MessageCircle, Info, Mic, Search, ListFilter, Archive, Download, Eye, Sparkles, Trash2, ShieldCheck, CheckSquare, Square, FileText, Share2 \} from "lucide-react";/g,
  `import { Bot, MessageSquare, Send, StopCircle, RefreshCw, Paperclip, Plus, MoreVertical, X, Pencil, Check, Settings, MessageCircle, Info, Mic, Search, ListFilter, Archive, Download, Eye, Sparkles, Trash2, ShieldCheck, CheckSquare, Square, MinusSquare, FileText, Share2 } from "lucide-react";`
);

fs.writeFileSync('src/components/ChatWorkspace.tsx', content, 'utf8');
