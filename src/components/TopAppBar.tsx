import React, { useState, useRef, useEffect } from "react";
import {
  User,
  Sun,
  Moon,
  LayoutGrid,
  Sliders,
  MoreVertical,
  FolderGit2,
  Layers,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PromptType, ProjectInfo, JulesSession } from "../types";
import { SettingsTab } from "../types";
import { useTheme } from "../hooks/useTheme";
import { useGoogleAuth } from "../hooks/useGoogleAuth";
import { TokenCounterVisualization } from "./TokenCounterVisualization";
import { useServices } from "../services/ServiceContext";
import { PWAInstallButton } from "./PWAInstallButton";


export interface TopAppBarProps {
  promptType: PromptType;
  onSelectPromptType?: (type: PromptType) => void;
  currentModelName: string;
  onOpenParameters: () => void;
  onOpenSettings: (tab?: SettingsTab) => void;
  onOpenBottomNav: () => void;
  hasApiKey: boolean;
  totalTokens?: number;
  maxTokens?: number;
  systemInstruction?: string;
  onUpdateSystemInstruction?: (instruction: string) => void;
  onOpenCustomTabBrowser?: () => void;
  onOpenImportProject?: () => void;
  activeProjectName?: string;
  activeProject?: ProjectInfo | null;
  projects?: ProjectInfo[];
  onSelectProject?: (project: ProjectInfo) => void;
  activeJulesSession?: JulesSession | null;
  onOpenJulesSessions?: () => void;
  onOpenPromptTemplates?: () => void;
  selectedTemplateCount?: number;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({

  promptType,
  currentModelName,
  onOpenParameters,
  onOpenSettings,
  onOpenBottomNav,
  hasApiKey,
  totalTokens = 0,
  maxTokens = 1_000_000,
  activeProjectName,
  activeProject = null,
  activeJulesSession = null,
  onOpenJulesSessions,
  onOpenPromptTemplates,
  selectedTemplateCount = 0,
}) => {
  const { resolvedTheme } = useTheme();
  const { user: googleUser } = useGoogleAuth();
  const { platformService } = useServices();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside or pressing Escape
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    const removeMouse = platformService.addDocumentListener("mousedown", handleClickOutside);
    const removeKey = platformService.addEventListener("keydown", handleKeyDown);
    return () => {
      removeMouse();
      removeKey();
    };
  }, [isMenuOpen]);

  return (
    <header className="sticky top-0 z-30 h-16 bg-background/95 backdrop-blur-md border-b border-border px-3 sm:px-4 flex items-center justify-between gap-2.5 transition shrink-0">
      {/* Left Zone: Borderless Token Count Display & Tuning Trigger (ADR 0037 / ADR 0039) */}
      <div className="flex items-center min-w-0">
        <TokenCounterVisualization
          tokens={totalTokens}
          maxTokens={maxTokens}
          onClick={onOpenParameters}
          borderless={true}
        />
      </div>

      {/* Right Zone: Primary Workspace Switcher & Overflow Navigation Popover (ADR 0037 / ADR 0039) */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* PWA Install Button (Displays when installable or on iOS) */}
        <PWAInstallButton variant="header" />

        {/* Prompt Templates Trigger Button */}
        {onOpenPromptTemplates && (
          <button
            type="button"
            id="top-prompt-templates-btn"
            onClick={onOpenPromptTemplates}
            className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer flex items-center justify-center min-w-[44px] min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary touch-manipulation relative"
            title="Prompt Templates (Modular directives)"
            aria-label="Prompt Templates"
          >
            <Layers className="w-4 h-4 text-primary" />
            {selectedTemplateCount > 0 && (
              <span className="absolute -top-1 -end-1 text-xs text-muted-foreground/70 font-medium bg-background px-1 border border-border/40 rounded shadow-sm">
                {selectedTemplateCount}
              </span>
            )}
          </button>
        )}

        {/* Standardized Primary Workspace Switcher Button (ADR 0045 / Navigation Consistency) */}
        <button
          type="button"
          id="top-workspace-switcher-btn"
          onClick={onOpenBottomNav}
          className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer flex items-center justify-center min-w-[44px] min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary touch-manipulation"
          title={`Switch Workspace (${activeProject?.name || activeProjectName || "Default"})`}
          aria-label="Switch Workspace"
        >
          <LayoutGrid className="w-4 h-4 text-primary" />
        </button>

        {/* Persistent Overflow Menu Anchor with Navigation Popover (ADR 0037 / ADR 0039) */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            id="top-settings-btn"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition relative cursor-pointer flex items-center justify-center min-w-[44px] min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary touch-manipulation"
            title="Navigation & more options"
            aria-label="Navigation & more options"
            aria-expanded={isMenuOpen}
            aria-haspopup="true"
          >
            <MoreVertical className="w-4 h-4" />
            {!hasApiKey && (
              <span className="absolute -top-1 -end-1 text-xs text-muted-foreground/70 font-medium bg-background px-1 border border-border/40 rounded shadow-sm">
                !
              </span>
            )}
          </button>

          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                key="header-overflow-popover"
                id="header-overflow-popover"
                role="menu"
                aria-orientation="vertical"
                aria-labelledby="top-settings-btn"
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.135, ease: "easeOut" }}
                className="absolute end-0 top-full mt-2 w-56 sm:w-64 rounded-xl bg-popover text-popover-foreground border border-border shadow-md p-1.5 z-40 origin-top-end"
              >
                <div className="flex flex-col gap-0.5">
                {/* Option 1: Profile (Takes user to Auth) */}
                <button
                  type="button"
                  id="overflow-nav-profile"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenSettings("account");
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted text-start transition cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-semibold text-foreground tracking-tight">
                      Profile
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {googleUser?.name || googleUser?.email || (hasApiKey ? "Account & API Keys" : "Connect Account")}
                    </span>
                  </div>
                </button>

                {/* Option 2: Themes Drawer */}
                <button
                  type="button"
                  id="overflow-nav-theme"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenSettings("display");
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted text-start transition cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="w-7 h-7 rounded-lg bg-muted text-muted-foreground group-hover:text-foreground flex items-center justify-center shrink-0 transition">
                    {resolvedTheme === "dark" ? (
                      <Moon className="w-4 h-4" />
                    ) : (
                      <Sun className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-semibold text-foreground tracking-tight">
                      Themes
                    </span>
                    <span className="text-[11px] text-muted-foreground capitalize truncate">
                      {resolvedTheme === "dark" ? "Dark Theme" : "Light Theme"} • Appearance
                    </span>
                  </div>
                </button>

                {/* Option 3: Settings */}
                <button
                  type="button"
                  id="overflow-nav-settings"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenSettings("settings");
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted text-start transition cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="w-7 h-7 rounded-lg bg-muted text-muted-foreground group-hover:text-foreground flex items-center justify-center shrink-0 transition">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-semibold text-foreground tracking-tight">
                      Settings
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      Security, Audio & Storage
                    </span>
                  </div>
                </button>

                {/* Option 4: Models & Tuners */}
                <button
                  type="button"
                  id="overflow-nav-models"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenParameters();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted text-start transition cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="w-7 h-7 rounded-lg bg-muted text-muted-foreground group-hover:text-foreground flex items-center justify-center shrink-0 transition">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-semibold text-foreground tracking-tight">
                      Models & Tuners
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {currentModelName} • Gemini 3.8 & Flash
                    </span>
                  </div>
                </button>

                {/* Optional Jules Sessions Switcher if Jules Mode */}
                {promptType === "jules" && onOpenJulesSessions && (
                  <button
                    type="button"
                    id="overflow-nav-jules-sessions"
                    role="menuitem"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenJulesSessions();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted text-start transition cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div className="w-7 h-7 rounded-lg bg-muted text-muted-foreground group-hover:text-foreground flex items-center justify-center shrink-0 transition">
                      <FolderGit2 className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs font-semibold text-foreground tracking-tight">
                        Jules Sessions
                      </span>
                      <span className="text-[11px] text-muted-foreground truncate">
                        {activeJulesSession ? activeJulesSession.repository : "Switch Repository"}
                      </span>
                    </div>
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
