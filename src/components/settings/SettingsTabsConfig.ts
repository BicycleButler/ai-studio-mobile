import {
  User,
  Cpu,
  Blocks,
  Sun,
  Sliders,
  Layers,
  Volume2,
  FolderHeart,
  Code2,
  Compass,
  LucideIcon
} from "lucide-react";
import { SettingsTab } from "../../types";

export interface SettingsTabConfig {
  id: SettingsTab;
  label: string;
  title: string;
  icon: LucideIcon;
  requiresAuthWarning?: boolean;
  aliases?: string[];
}

export const SETTINGS_TABS_CONFIG: SettingsTabConfig[] = [
  { id: "account", label: "Profile", title: "Profile & Account", icon: User, requiresAuthWarning: true, aliases: ["auth", "key", "profile"] },
  { id: "providers", label: "Providers", title: "Providers & Local Models", icon: Cpu, aliases: ["local", "ollama", "webgpu", "openai", "anthropic"] },
  { id: "integrations", label: "Integrations", title: "Cloud & Dev Integrations", icon: Blocks, aliases: ["firebase", "gcp", "github", "vercel", "cloud"] },
  { id: "display", label: "Themes", title: "Themes & Appearance", icon: Sun, aliases: ["theme", "themes"] },
  { id: "security", label: "Settings", title: "Settings & Security", icon: Sliders, aliases: ["settings"] },
  { id: "model", label: "Models", title: "Models & Tuners", icon: Layers, aliases: ["tune", "models"] },
  { id: "audio", label: "Audio", title: "Voice & Audio", icon: Volume2 },
  { id: "library", label: "Library", title: "Prompt Library", icon: FolderHeart },
  { id: "export", label: "Code", title: "Get Code", icon: Code2 },
  { id: "companion", label: "Guide", title: "Companion & Guide", icon: Compass },
];

export function resolveSettingsTab(tab?: string): SettingsTab {
  if (!tab) return "account";

  const found = SETTINGS_TABS_CONFIG.find(t => t.id === tab || t.aliases?.includes(tab));
  return found ? found.id : "account";
}
