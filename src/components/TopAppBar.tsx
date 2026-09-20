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
import { PromptType, GoogleUser, ProjectInfo, JulesSession } from "../types";
import { SettingsTab } from "./UnifiedSettingsModal";
import { useTheme } from "../hooks/useTheme";
import { TokenCounterVisualization } from "./TokenCounterVisualization";
import { PWAInstallButton } from "./PWAInstallButton";

interface TopAppBarProps {
  promptType: PromptType;
  onSelectPromptType?: (type: PromptType) => void;
  currentModelName: string;
  onOpenParameters: () => void;
  onOpenSettings: (tab?: SettingsTab) => void;
  onOpenBottomNav: () => void;
  hasApiKey: boolean;
  googleUser?: GoogleUser | null;
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
  googleUser = null,
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

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <header className="sticky top-0 z-30 h-16 bg-background/95 backdrop-blur-md border-b border-border px-3 sm:px-4 flex items-center justify-between gap-2.5 transition-colors">
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
            className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center justify-center min-w-[44px] min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary touch-manipulation relative"
            title="Prompt Templates (Modular directives)"
            aria-label="Prompt Templates"
          >
            <Layers className="w-4 h-4 text-primary" />
            {selectedTemplateCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-mono font-bold flex items-center justify-center shadow-xs">
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
          className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center justify-center min-w-[44px] min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary touch-manipulation"
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
            className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors relative cursor-pointer flex items-center justify-center min-w-[44px] min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary touch-manipulation"
            title="Navigation & more options"
            aria-label="Navigation & more options"
            aria-expanded={isMenuOpen}
            aria-haspopup="true"
          >
            <MoreVertical className="w-4 h-4" />
            {!hasApiKey && (
              <span className="absolute top-1.5 right-1.5 px-1 py-0.2 rounded text-[8px] font-mono text-muted-foreground bg-muted/80 border border-border/40">
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
                className="absolute right-0 top-full mt-2 w-56 sm:w-64 rounded-xl bg-popover text-popover-foreground border border-border shadow-md p-1.5 z-40 origin-top-right"
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
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted text-left transition-colors cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted text-left transition-colors cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="w-7 h-7 rounded-lg bg-muted text-muted-foreground group-hover:text-foreground flex items-center justify-center shrink-0 transition-colors">
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
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted text-left transition-colors cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="w-7 h-7 rounded-lg bg-muted text-muted-foreground group-hover:text-foreground flex items-center justify-center shrink-0 transition-colors">
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
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted text-left transition-colors cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="w-7 h-7 rounded-lg bg-muted text-muted-foreground group-hover:text-foreground flex items-center justify-center shrink-0 transition-colors">
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
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted text-left transition-colors cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div className="w-7 h-7 rounded-lg bg-muted text-muted-foreground group-hover:text-foreground flex items-center justify-center shrink-0 transition-colors">
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
