const fs = require('fs');

let content = fs.readFileSync('src/components/settings/SettingsAccountTab.tsx', 'utf8');
content = content.replace(
  /import \{ ShieldCheck, CheckCircle2, Lock, Smartphone, ExternalLink, Bot, Check, FolderPlus, Folder, Trash2,\n\s*Clock, Edit2, Loader2, AlertCircle \} from "lucide-react";/,
  'import { ShieldCheck, CheckCircle2, Lock, Smartphone, ExternalLink, Bot, Check, FolderPlus, Folder, Trash2,\n  Clock, Edit2, Loader2, AlertCircle, CheckSquare, MinusSquare, Square } from "lucide-react";'
);
fs.writeFileSync('src/components/settings/SettingsAccountTab.tsx', content, 'utf8');
