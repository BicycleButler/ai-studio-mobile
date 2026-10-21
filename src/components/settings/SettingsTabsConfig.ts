import {
  User,
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
  icon: LucideIcon;
  requiresAuthWarning?: boolean;
}

export const SETTINGS_TABS_CONFIG: SettingsTabConfig[] = [
  { id: "account", label: "Profile", icon: User, requiresAuthWarning: true },
  { id: "display", label: "Themes", icon: Sun },
  { id: "security", label: "Settings", icon: Sliders },
  { id: "model", label: "Models", icon: Layers },
  { id: "audio", label: "Audio", icon: Volume2 },
  { id: "library", label: "Library", icon: FolderHeart },
  { id: "export", label: "Code", icon: Code2 },
  { id: "companion", label: "Guide", icon: Compass },
];
