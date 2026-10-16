import fs from 'fs';

let content = fs.readFileSync('src/components/settings/SettingsAccountTab.tsx', 'utf-8');

const search = `import { DatasetScopeBanner } from "../DatasetScopeBanner";

import { ShieldCheck, CheckCircle2, Lock, Smartphone, ExternalLink, Bot, Check, FolderPlus, Folder, Trash2, Edit2, Loader2, AlertCircle } from "lucide-react";
import { GoogleUser, ProjectInfo } from "../../types";
import { GoogleAuthCard } from "../GoogleAuthCard";`;

const replace = `import { DatasetScopeBanner } from "../DatasetScopeBanner";
import { FloatingBatchActionBar } from "../FloatingBatchActionBar";
import { AnimatePresence, motion } from "motion/react";

import { ShieldCheck, CheckCircle2, Lock, Smartphone, ExternalLink, Bot, Check, FolderPlus, Folder, Trash2, Edit2, Loader2, AlertCircle } from "lucide-react";
import { GoogleUser, ProjectInfo } from "../../types";
import { GoogleAuthCard } from "../GoogleAuthCard";`;

content = content.replace(search, replace);
fs.writeFileSync('src/components/settings/SettingsAccountTab.tsx', content);
