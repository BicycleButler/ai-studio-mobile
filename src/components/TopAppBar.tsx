import React, { useState, useRef } from "react";
import {
  Sparkles,
  SlidersHorizontal,
  Menu,
  ChevronDown,
  ChevronUp,
  Mic,
  X,
  Check,
  ExternalLink,
  FolderPlus,
  FolderGit2,
  Sun,
  Moon,
} from "lucide-react";
import { PromptType, GoogleUser, ProjectInfo, JulesSession } from "../types";
import { SettingsTab } from "./UnifiedSettingsModal";
import { useSpeechToText } from "../hooks/useSpeechToText";
import { useTheme } from "../hooks/useTheme";
import { TokenCounterVisualization } from "./TokenCounterVisualization";
import { GoogleIcon } from "./GoogleIcon";

interface TopAppBarProps {
  promptType: PromptType;
  onSelectPromptType?: (type: PromptType) => void;
  currentModelName: string;
  onOpenParameters: () => void;
  onOpenSettings: (tab?: SettingsTab) => void;
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
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  promptType,
  onSelectPromptType,
  currentModelName,
  onOpenParameters,
  onOpenSettings,
  hasApiKey,
  googleUser = null,
  totalTokens = 0,
  maxTokens = 1_000_000,
  systemInstruction = "",
  onUpdateSystemInstruction,
  onOpenCustomTabBrowser,
  onOpenImportProject,
  activeProjectName,
  activeProject = null,
  projects = [],
  onSelectProject,
  activeJulesSession = null,
  onOpenJulesSessions,
}) => {
  const { resolvedTheme, toggleTheme } = useTheme();

  // Expandable drawer tucked away by default to clean up space
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSysInstructionsOpen, setIsSysInstructionsOpen] = useState(false);
  const sysTextareaRef = useRef<HTMLTextAreaElement>(null);
  const sysSpeechBaseTextRef = useRef<string>("");

  const {
    isListening,
    startListening,
    stopListening,
  } = useSpeechToText({
    onTranscript: (chunk) => {
      const base = sysSpeechBaseTextRef.current;
      const sep = base && !base.endsWith(" ") ? " " : "";
      const updated = base ? `${base}${sep}${chunk}` : chunk;
      onUpdateSystemInstruction?.(updated);
    },
  });

  const handleToggleSysSpeech = () => {
    setIsSysInstructionsOpen(true);
    setTimeout(() => {
      if (sysTextareaRef.current) {
        sysTextareaRef.current.focus();
        const len = sysTextareaRef.current.value.length;
        sysTextareaRef.current.setSelectionRange(len, len);
      }
    }, 50);

    if (isListening) {
      stopListening();
    } else {
      sysSpeechBaseTextRef.current = systemInstruction || "";
      startListening();
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-3 py-2 transition-colors">
      {/* Top Bar Row: Sparkle Icon (Top Left Corner) & Menu / Tokens (Right) */}
      <div className="flex items-center justify-between gap-3">
        {/* Top Left Corner: Sparkle Icon button to expand or compress the drawer */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            id="sparkle-drawer-toggle-btn"
            onClick={() => setIsExpanded((prev) => !prev)}
            className={`flex items-center gap-1.5 p-1.5 px-2 rounded-xl border transition-colors cursor-pointer ${
              isExpanded
                ? "bg-primary/20 text-primary border-primary/50 shadow-sm"
                : "bg-card hover:bg-muted text-muted-foreground hover:text-foreground border-border shadow-sm"
            }`}
            title={
              isExpanded
                ? "Compress drawer (clean up UI)"
                : "Expand drawer (AI Studio, Model, Mode switcher, System Instructions)"
            }
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Compress Studio drawer" : "Expand Studio drawer"}
          >
            <div className="relative flex items-center justify-center">
              <Sparkles
                className={`w-4 h-4 transition-transform duration-200 ${
                  isExpanded ? "text-primary rotate-12 scale-110" : "text-primary"
                }`}
              />
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${
                isExpanded ? "rotate-180 text-primary" : ""
              }`}
            />
          </button>

          {/* Contextual Jules Repository & Session Button */}
          {promptType === "jules" && (
            <button
              type="button"
              id="header-jules-session-btn"
              onClick={onOpenJulesSessions}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-950/40 hover:bg-purple-900/50 text-purple-200 hover:text-white border border-purple-500/40 hover:border-purple-500/60 text-xs font-semibold shadow-sm transition-colors active:scale-[0.98] min-w-0 shrink"
              title="Manage Jules Sessions & Authorized Repositories"
            >
              <FolderGit2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="truncate max-w-[85px] xs:max-w-[130px] sm:max-w-[170px]">
                {activeJulesSession ? activeJulesSession.repository : "Select Repo"}
              </span>
              <ChevronDown className="w-3 h-3 text-purple-400 shrink-0" />
            </button>
          )}
        </div>

        {/* Top Right Corner Actions: Token Counter & Menu Drawer Trigger */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Token Counter Visualization only shown when not in Jules mode */}
          {promptType !== "jules" && (
            <TokenCounterVisualization
              tokens={totalTokens}
              maxTokens={maxTokens}
              onClick={onOpenParameters}
            />
          )}

          {/* Quick Theme Toggle Button */}
          <button
            type="button"
            id="header-theme-toggle-btn"
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition-colors cursor-pointer flex items-center justify-center min-w-[36px] min-h-[36px]"
            title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {resolvedTheme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-500" />
            )}
          </button>

          <button
            type="button"
            id="top-settings-btn"
            onClick={() => onOpenSettings("account")}
            className="p-2 rounded-lg bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition-colors relative group cursor-pointer flex items-center justify-center min-w-[36px] min-h-[36px]"
            title="Settings Hub (Account, Audio, Display, Security)"
            aria-label="Open settings"
          >
            <Menu className="w-4 h-4 transition-transform duration-150 group-active:scale-95" />
            {!hasApiKey && (
              <span className="absolute top-1 right-1 px-1 py-0.2 rounded text-[8px] font-mono text-muted-foreground bg-muted/80 border border-border/40">
                !
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Expandable Drawer: Contains AI Studio text, model & filter icon, 3 mode buttons, and system instructions drawer */}
      {isExpanded && (
        <div
          id="expandable-studio-drawer"
          className="mt-2.5 pt-2.5 border-t border-border flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {/* 1. Text for AI Studio & Close/Compress action */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-semibold tracking-tight text-foreground leading-tight">
                Client for Google AI Studio
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Compress drawer"
              aria-label="Compress drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 2. Model being used OR Jules target repository */}
          {promptType === "jules" ? (
            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-card border border-purple-500/30">
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold">
                  Jules Target Repository
                </span>
                <span className="text-xs font-medium text-foreground truncate font-mono">
                  {activeJulesSession ? `${activeJulesSession.repository} (${activeJulesSession.branch})` : "No session selected"}
                </span>
              </div>

              <button
                type="button"
                onClick={onOpenJulesSessions}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 hover:text-white border border-purple-500/40 text-xs font-medium transition-colors shrink-0 shadow-sm cursor-pointer"
                title="Switch Jules task or repository"
              >
                <FolderGit2 className="w-3.5 h-3.5 text-purple-400" />
                <span>Switch Task</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-card border border-border">
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Active Model
                </span>
                <span className="text-xs font-medium text-foreground truncate">
                  {currentModelName}
                </span>
              </div>

              {/* Filter icon to change model or tune parameters */}
              <button
                type="button"
                id="model-chip-trigger"
                onClick={() => {
                  onOpenParameters();
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card hover:bg-muted text-primary hover:text-primary border border-border text-xs font-medium transition-colors shrink-0 shadow-sm cursor-pointer"
                title="Change model or tune parameters"
                aria-label="Change model or tune parameters"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                <span>Change / Tune</span>
              </button>
            </div>
          )}

          {/* System Instructions Drawer */}
          <div className="rounded-xl bg-card border border-border p-2.5">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <button
                type="button"
                onClick={() => setIsSysInstructionsOpen((prev) => !prev)}
                className="flex items-center gap-1.5 text-foreground hover:text-foreground font-medium transition-colors cursor-pointer"
              >
                <span>System Instructions</span>
                <ChevronDown
                  className={`w-3 h-3 text-muted-foreground transition-transform ${
                    isSysInstructionsOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground font-mono">
                  {systemInstruction.length} chars
                </span>
                {systemInstruction && (
                  <button
                    type="button"
                    onClick={() => onUpdateSystemInstruction?.("")}
                    className="text-[10px] text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* System instructions textarea and microphone button */}
            {isSysInstructionsOpen ? (
              <div className="mt-2 relative">
                <textarea
                  ref={sysTextareaRef}
                  id="drawer-system-instruction-textarea"
                  value={systemInstruction}
                  onChange={(e) => onUpdateSystemInstruction?.(e.target.value)}
                  placeholder="Give the model behavioral instructions, persona, guidelines, or formatting rules..."
                  rows={3}
                  className="w-full text-xs bg-muted/50 border border-input rounded-lg p-2 text-foreground placeholder:text-subtle-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none pr-8"
                />
                <button
                  type="button"
                  id="drawer-sys-mic-btn"
                  onClick={handleToggleSysSpeech}
                  className={`absolute right-2 top-2 p-1.5 rounded-md transition-colors cursor-pointer ${
                    isListening
                      ? "bg-destructive text-destructive-foreground animate-pulse /* recording validation */"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                  title={isListening ? "Stop dictation" : "Dictate system instructions"}
                  aria-label="Dictate system instructions"
                >
                  <Mic className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <p
                onClick={() => setIsSysInstructionsOpen(true)}
                className="text-[11px] text-subtle-foreground hover:text-muted-foreground cursor-pointer truncate italic"
              >
                {systemInstruction
                  ? systemInstruction
                  : "Tap to define persona, behavioral guidelines, or formatting rules..."}
              </p>
            )}
          </div>

          {/* Google Account Connection Status in Drawer */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded-full bg-card flex items-center justify-center p-1 shrink-0 border border-border">
                <GoogleIcon className="w-full h-full" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Google Account
                </span>
                <span className="text-xs text-foreground truncate">
                  {googleUser ? googleUser.email : "Not signed in"}
                </span>
              </div>
            </div>

            <button
              type="button"
              id="drawer-google-auth-trigger"
              onClick={() => onOpenSettings("account")}
              className="px-2.5 py-1 rounded-lg bg-card hover:bg-muted text-primary hover:text-primary text-xs font-medium border border-border transition-colors shrink-0 cursor-pointer"
            >
              {googleUser ? "Manage" : "Sign In"}
            </button>
          </div>

          {/* Interactive AI Studio Key Launcher & Multi-Project Switcher Row */}
          <div className="p-2.5 rounded-xl bg-card border border-border space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Active Project & Key
                </span>
                <span className="text-xs font-medium text-foreground truncate">
                  {activeProject?.name || activeProjectName || (hasApiKey ? "Custom / AI Studio Key" : "No Project Active")}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {onOpenCustomTabBrowser && (
                  <button
                    type="button"
                    id="drawer-launch-aistudio-btn"
                    onClick={onOpenCustomTabBrowser}
                    className="px-2.5 py-1 rounded-lg bg-card hover:bg-muted text-primary text-xs font-medium border border-border flex items-center gap-1 transition-colors cursor-pointer"
                    title="Launch Google AI Studio in-app browser tab"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span className="hidden xs:inline">Get Key</span>
                  </button>
                )}
                {onOpenImportProject && (
                  <button
                    type="button"
                    id="drawer-import-project-btn"
                    onClick={onOpenImportProject}
                    className="px-2.5 py-1 rounded-lg bg-card hover:bg-muted text-foreground text-xs font-medium border border-border flex items-center gap-1 transition-colors cursor-pointer"
                    title="Import or configure project key"
                  >
                    <FolderPlus className="w-3 h-3 text-primary" />
                    <span>+ Project</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Project Switcher Selector / Pills in Drawer */}
            {projects.length > 0 && (
              <div className="pt-2 border-t border-border space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Saved Projects ({projects.length})</span>
                  <button
                    type="button"
                    id="drawer-manage-projects-link"
                    onClick={() => {
                      setIsExpanded(false);
                      onOpenSettings("account");
                    }}
                    className="text-primary hover:underline cursor-pointer"
                  >
                    Manage Workspace
                  </button>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {projects.map((proj) => {
                    const isSelected = activeProject?.id === proj.id;
                    return (
                      <button
                        key={proj.id}
                        type="button"
                        id={`drawer-project-pill-${proj.id}`}
                        onClick={() => onSelectProject?.(proj)}
                        className={`px-2 py-1 rounded-lg text-xs font-medium shrink-0 transition-colors flex items-center gap-1.5 border cursor-pointer ${
                          isSelected
                            ? "bg-primary/20 border-primary text-foreground shadow-sm"
                            : "bg-card hover:bg-muted border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {isSelected && (
                          <Check className="w-3 h-3 text-primary shrink-0" />
                        )}
                        <span className="truncate max-w-[100px]">{proj.name}</span>
                        {proj.apiKey && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            ...{proj.apiKey.slice(-4)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Compress Drawer quick action */}
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="w-full py-1 text-center text-[11px] text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 border-t border-border pt-1.5 transition-colors cursor-pointer"
          >
            <ChevronUp className="w-3 h-3" />
            <span>Compress Drawer</span>
          </button>
        </div>
      )}
    </header>
  );
};

