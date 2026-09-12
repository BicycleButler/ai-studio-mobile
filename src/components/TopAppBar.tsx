import React, { useState, useRef } from "react";
import {
  Sparkles,
  SlidersHorizontal,
  Menu,
  ChevronDown,
  ChevronUp,
  Cpu,
  Mic,
  X,
  MessageSquare,
  FileText,
  Layers,
  Code2,
  Check,
  ExternalLink,
  FolderPlus,
  Key,
  AlertTriangle,
} from "lucide-react";
import { PromptType, GoogleUser, ProjectInfo } from "../types";
import { SettingsTab } from "./UnifiedSettingsModal";
import { useSpeechToText } from "../hooks/useSpeechToText";
import { TokenCounterVisualization } from "./TokenCounterVisualization";

const PROMPT_MODES: {
  id: PromptType;
  label: string;
  shortLabel: string;
  subtitle: string;
  icon: typeof MessageSquare;
  color: string;
}[] = [
  {
    id: "chat",
    label: "Chat Prompt",
    shortLabel: "Chat",
    subtitle: "Conversational & multi-turn dialog",
    icon: MessageSquare,
    color: "text-blue-400",
  },
  {
    id: "freeform",
    label: "Freeform",
    shortLabel: "Freeform",
    subtitle: "Prompt engineering with {{variables}}",
    icon: FileText,
    color: "text-emerald-400",
  },
  {
    id: "structured",
    label: "Structured",
    shortLabel: "Structured",
    subtitle: "Input & output example training pairs",
    icon: Layers,
    color: "text-purple-400",
  },
  {
    id: "code",
    label: "Code View",
    shortLabel: "Code IDE",
    subtitle: "Mobile IDE with files & runner console",
    icon: Code2,
    color: "text-amber-400",
  },
];

interface TopAppBarProps {
  promptType: PromptType;
  onSelectPromptType: (type: PromptType) => void;
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
}) => {
  // Expandable drawer tucked away by default to clean up space
  const [isExpanded, setIsExpanded] = useState(false);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [isSysInstructionsOpen, setIsSysInstructionsOpen] = useState(false);
  const sysTextareaRef = useRef<HTMLTextAreaElement>(null);
  const sysSpeechBaseTextRef = useRef<string>("");

  const currentMode = PROMPT_MODES.find((m) => m.id === promptType) || PROMPT_MODES[0];
  const CurrentModeIcon = currentMode.icon;

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
    <header className="sticky top-0 z-30 bg-[#131314]/95 backdrop-blur-md border-b border-[#2b2c31] px-3 py-2 transition-colors">
      {/* Top Bar Row: Sparkle Icon (Top Left Corner) & Menu / Tokens (Right) */}
      <div className="flex items-center justify-between gap-3">
        {/* Top Left Corner: Sparkle Icon button to expand or compress the drawer */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            id="sparkle-drawer-toggle-btn"
            onClick={() => setIsExpanded((prev) => !prev)}
            className={`flex items-center gap-1.5 p-1.5 px-2 rounded-xl border transition-colors ${
              isExpanded
                ? "bg-blue-600/20 text-blue-300 border-blue-500/50 shadow-sm shadow-blue-500/25"
                : "bg-[#1f1f23] hover:bg-[#282a30] text-[#c4c7c5] hover:text-white border-[#31333a] shadow-sm"
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
                  isExpanded ? "text-blue-400 rotate-12 scale-110" : "text-blue-400"
                }`}
              />
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-[#9aa0a6] transition-transform duration-200 ${
                isExpanded ? "rotate-180 text-blue-400" : ""
              }`}
            />
          </button>

          {/* Interactive State Selector in Header (tap to switch between Chat, Freeform, Structured, Code View) */}
          <div className="relative">
            <button
              type="button"
              id="header-prompt-state-btn"
              onClick={() => setIsModeMenuOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1a1b20] hover:bg-[#25272e] text-[#e3e3e3] hover:text-white border border-[#2b2d35] hover:border-[#383b45] text-xs font-semibold shadow-sm transition-colors active:scale-[0.98] group cursor-pointer"
              title="Select prompt state or open Mobile IDE"
              aria-haspopup="true"
              aria-expanded={isModeMenuOpen}
            >
              <CurrentModeIcon className={`w-3.5 h-3.5 ${currentMode.color} shrink-0`} />
              <span className="truncate max-w-[110px] xs:max-w-none">
                {currentMode.label}
              </span>
              {systemInstruction ? (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"
                  title="Active system instructions"
                />
              ) : null}
              <ChevronDown
                className={`w-3.5 h-3.5 text-[#9aa0a6] transition-transform duration-150 group-hover:text-white ${
                  isModeMenuOpen ? "rotate-180 text-blue-400" : ""
                }`}
              />
            </button>

            {/* Interactive Mode Dropdown Menu */}
            {isModeMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
                  onClick={() => setIsModeMenuOpen(false)}
                />
                <div
                  id="header-mode-dropdown-menu"
                  className="absolute left-0 mt-1.5 w-64 z-50 rounded-xl bg-[#191a20] border border-[#2e313b] shadow-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100"
                >
                  <div className="px-2.5 py-1 text-[10px] uppercase font-semibold tracking-wider text-[#71767b]">
                    Select State / Workspace
                  </div>
                  {PROMPT_MODES.map((mode) => {
                    const Icon = mode.icon;
                    const isSelected = promptType === mode.id;
                    return (
                      <button
                        key={mode.id}
                        id={`mode-menu-option-${mode.id}`}
                        type="button"
                        onClick={() => {
                          onSelectPromptType(mode.id);
                          setIsModeMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                          isSelected
                            ? "bg-[#252833] text-white border border-[#3b3f4f]"
                            : "text-[#c4c7c5] hover:text-white hover:bg-[#20222a]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isSelected ? "bg-blue-600/20 text-blue-400" : "bg-[#141519] text-[#9aa0a6]"
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium leading-tight">{mode.label}</span>
                              {mode.id === "code" && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-muted/60 text-zinc-300 border border-border/40 font-mono font-semibold">
                                  IDE
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-[#71767b] block truncate leading-tight mt-0.5">
                              {mode.subtitle}
                            </span>
                          </div>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Interactive Project Switcher Pill in Collapsed Header */}
          <div className="relative">
            {(() => {
              const isAttentionRequired = Boolean(
                activeProject && (!activeProject.isValid || activeProject.status === "invalid_key" || activeProject.status === "attention_required")
              );
              return (
                <button
                  type="button"
                  id="header-project-switcher-btn"
                  onClick={() => setIsProjectMenuOpen((prev) => !prev)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-semibold shadow-sm transition-colors active:scale-[0.98] group cursor-pointer ${
                    isAttentionRequired
                      ? "bg-[#261f1c] hover:bg-[#322722] text-zinc-200 border-[#4a3429]"
                      : "bg-[#1a1b20] hover:bg-[#25272e] text-[#e3e3e3] hover:text-white border-[#2b2d35] hover:border-[#383b45]"
                  }`}
                  title={
                    isAttentionRequired
                      ? "Attention Required: API key expired, revoked, or unauthorized. Tap to update."
                      : activeProject
                      ? `Active Project: ${activeProject.name}`
                      : "Select or configure project"
                  }
                  aria-haspopup="true"
                  aria-expanded={isProjectMenuOpen}
                >
                  {isAttentionRequired ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
                  ) : (
                    <Key className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  )}
                  <span className="truncate max-w-[70px] xs:max-w-[100px] sm:max-w-[130px]">
                    {activeProject ? activeProject.name : (hasApiKey ? "Custom Key" : "No Project")}
                  </span>
                  {activeProject?.apiKey && (
                    <span className="text-[10px] text-zinc-400 font-mono hidden md:inline">
                      ...{activeProject.apiKey.slice(-5)}
                    </span>
                  )}
                  {isAttentionRequired && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  )}
                  <ChevronDown
                    className={`w-3 h-3 text-[#9aa0a6] transition-transform duration-150 group-hover:text-white ${
                      isProjectMenuOpen ? "rotate-180 text-blue-400" : ""
                    }`}
                  />
                </button>
              );
            })()}

            {/* Interactive Project Dropdown Menu */}
            {isProjectMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
                  onClick={() => setIsProjectMenuOpen(false)}
                />
                <div
                  id="header-project-dropdown-menu"
                  className="absolute left-0 mt-1.5 w-72 z-50 rounded-xl bg-[#191a20] border border-[#2e313b] shadow-2xl p-2 space-y-1 animate-in fade-in zoom-in-95 duration-100"
                >
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-[#71767b]">
                      Switch Project ({projects.length})
                    </span>
                    <button
                      type="button"
                      id="header-manage-projects-btn"
                      onClick={() => {
                        setIsProjectMenuOpen(false);
                        onOpenSettings("auth");
                      }}
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-medium transition-colors"
                    >
                      Manage
                    </button>
                  </div>

                  {/* Attention Required Banner in Dropdown */}
                  {activeProject && (!activeProject.isValid || activeProject.status === "invalid_key" || activeProject.status === "attention_required") && (
                    <div className="p-2 rounded-lg bg-[#241c19] border border-[#482f23] text-zinc-200 text-xs mb-1.5">
                      <div className="flex items-start gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-white block">Key Expired or Revoked</span>
                          <span className="text-[11px] text-zinc-400 leading-tight block mt-0.5">
                            Update API Key in AI Studio to resume requests
                          </span>
                        </div>
                      </div>
                      {onOpenCustomTabBrowser && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsProjectMenuOpen(false);
                            onOpenCustomTabBrowser();
                          }}
                          className="mt-2 w-full py-1 px-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Update in AI Studio</span>
                        </button>
                      )}
                    </div>
                  )}

                  {projects.length === 0 ? (
                    <div className="p-3 text-center rounded-lg bg-[#14151a] border border-[#262823]">
                      <p className="text-xs text-zinc-300">No projects saved yet</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        Import an AI Studio key to configure a workspace project.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-56 overflow-y-auto space-y-1 scrollbar-none">
                      {projects.map((proj) => {
                        const isSelected = activeProject?.id === proj.id;
                        const keyHint = proj.apiKey ? `...${proj.apiKey.slice(-5)}` : "";
                        const hasProblem = !proj.isValid || proj.status === "invalid_key" || proj.status === "attention_required";
                        return (
                          <button
                            key={proj.id}
                            type="button"
                            id={`header-project-item-${proj.id}`}
                            onClick={() => {
                              onSelectProject?.(proj);
                              setIsProjectMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                              isSelected
                                ? hasProblem
                                  ? "bg-[#271d19] text-white border border-[#482f23]"
                                  : "bg-[#252833] text-white border border-blue-500/40"
                                : "hover:bg-[#20222a] text-[#c4c7c5] hover:text-white border border-transparent"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                                  hasProblem
                                    ? "bg-muted text-foreground"
                                    : isSelected
                                    ? "bg-blue-500/20 text-blue-400"
                                    : "bg-zinc-800 text-zinc-400"
                                }`}
                              >
                                {hasProblem ? (
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                ) : (
                                  <Key className="w-3.5 h-3.5" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-medium truncate">{proj.name}</span>
                                  {hasProblem && (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-muted/60 text-zinc-400 border border-border/40 font-semibold">
                                      Expired
                                    </span>
                                  )}
                                  {keyHint && (
                                    <span className="text-[10px] font-mono text-zinc-400 bg-black/40 px-1 py-0.2 rounded">
                                      {keyHint}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-zinc-500 block truncate">
                                  {proj.defaultModel || "Default Model"}
                                </span>
                              </div>
                            </div>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-blue-400 shrink-0 ml-1.5" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Top Right Corner Actions: Google Account, Token Counter & Hamburger Menu */}
        <div className="flex items-center gap-1.5 shrink-0">
          {googleUser ? (
            <button
              type="button"
              id="header-google-user-btn"
              onClick={() => onOpenSettings("auth")}
              className="flex items-center gap-1.5 p-1 sm:px-2 sm:py-1 rounded-full bg-[#1b1f2e] hover:bg-[#252b3e] border border-blue-500/30 text-white transition-colors group shadow-sm"
              title={`Signed in as ${googleUser.email} (Google AI Studio Synced)`}
            >
              <div className="relative w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[11px] font-bold overflow-hidden border border-blue-400/50">
                {googleUser.picture ? (
                  <img
                    src={googleUser.picture}
                    alt={googleUser.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  googleUser.name.slice(0, 1).toUpperCase()
                )}
              </div>
              <span className="hidden sm:inline text-[11px] font-medium text-zinc-200 max-w-[85px] truncate">
                {googleUser.name.split(" ")[0]}
              </span>
            </button>
          ) : (
            <button
              type="button"
              id="header-google-signin-btn"
              onClick={() => onOpenSettings("auth")}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white hover:bg-zinc-100 text-[#1f1f23] text-xs font-semibold shadow-sm transition-colors active:scale-95"
              title="Sign in with Google Account"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span className="hidden xs:inline">Sign In</span>
            </button>
          )}

          {/* Token Counter Visualization directly to the left of the menu button */}
          <TokenCounterVisualization
            tokens={totalTokens}
            maxTokens={maxTokens}
            onClick={onOpenParameters}
          />

          <button
            type="button"
            id="top-settings-btn"
            onClick={() => onOpenSettings("tune")}
            className="p-2 rounded-lg bg-[#1f1f23] hover:bg-[#2b2c31] text-[#c4c7c5] hover:text-white border border-[#2b2c31] transition-colors relative group"
            title="Menu (Tune, Library, Get Code, Companion, Audio, Settings)"
            aria-label="Open menu"
          >
            <Menu className="w-4 h-4 transition-transform duration-150 group-active:scale-95" />
            {!hasApiKey && (
              <span className="absolute top-1 right-1 px-1 py-0.2 rounded text-[8px] font-mono text-zinc-400 bg-muted/80 border border-border/40">
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
          className="mt-2.5 pt-2.5 border-t border-[#25272e] flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {/* 1. Text for AI Studio & Close/Compress action */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-semibold tracking-tight text-white leading-tight">
                Client for Google AI Studio
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                Gemini Client
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="p-1 rounded-md text-[#9aa0a6] hover:text-white hover:bg-[#23242a] transition-colors"
              title="Compress drawer"
              aria-label="Compress drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 2. Model being used and Filter icon to change model or tune parameters */}
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#1a1b20] border border-[#2b2c31]">
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] uppercase tracking-wider text-[#9aa0a6] font-semibold">
                Active Model
              </span>
              <span className="text-xs font-medium text-white truncate">
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
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#25272e] hover:bg-[#2f323a] text-blue-300 hover:text-white border border-[#383b44] text-xs font-medium transition-colors shrink-0 shadow-sm"
              title="Change model or tune parameters"
              aria-label="Change model or tune parameters"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
              <span>Change / Tune</span>
            </button>
          </div>

          {/* System Instructions Drawer */}
          <div className="rounded-xl bg-[#17181c] border border-[#26282f] p-2.5">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <button
                type="button"
                onClick={() => setIsSysInstructionsOpen((prev) => !prev)}
                className="flex items-center gap-1.5 text-[#e3e3e3] hover:text-white font-medium transition-colors"
              >
                <Cpu className="w-3.5 h-3.5 text-blue-400" />
                <span>System Instructions</span>
                {systemInstruction ? (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                    title="Active system instructions"
                  />
                ) : null}
                <ChevronDown
                  className={`w-3 h-3 text-[#9aa0a6] transition-transform ${
                    isSysInstructionsOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 font-mono">
                  {systemInstruction.length} chars
                </span>
                {systemInstruction && (
                  <button
                    type="button"
                    onClick={() => onUpdateSystemInstruction?.("")}
                    className="text-[10px] text-zinc-400 hover:text-rose-400 transition-colors"
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
                  className="w-full text-xs bg-[#1f1f23] border border-[#2f3136] rounded-lg p-2 text-[#e3e3e3] placeholder-[#71767b] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors resize-none pr-8"
                />
                <button
                  type="button"
                  id="drawer-sys-mic-btn"
                  onClick={handleToggleSysSpeech}
                  className={`absolute right-2 top-2 p-1.5 rounded-md transition-colors ${
                    isListening
                      ? "bg-rose-600 text-white animate-pulse"
                      : "text-zinc-400 hover:text-white hover:bg-[#2c2d33]"
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
                className="text-[11px] text-[#71767b] hover:text-[#9aa0a6] cursor-pointer truncate italic"
              >
                {systemInstruction
                  ? systemInstruction
                  : "Tap to define persona, behavioral guidelines, or formatting rules..."}
              </p>
            )}
          </div>

          {/* Google Account Connection Status in Drawer */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#17181c] border border-[#26282f]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center p-1 shrink-0">
                <svg className="w-full h-full" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] uppercase tracking-wider text-[#9aa0a6] font-semibold">
                  Google Account
                </span>
                <span className="text-xs text-zinc-200 truncate">
                  {googleUser ? googleUser.email : "Not signed in"}
                </span>
              </div>
            </div>

            <button
              type="button"
              id="drawer-google-auth-trigger"
              onClick={() => onOpenSettings("auth")}
              className="px-2.5 py-1 rounded-lg bg-[#22242c] hover:bg-[#2b2e38] text-blue-400 hover:text-blue-300 text-xs font-medium border border-[#353844] transition-colors shrink-0"
            >
              {googleUser ? "Manage" : "Sign In"}
            </button>
          </div>

          {/* Interactive AI Studio Key Launcher & Multi-Project Switcher Row */}
          <div className="p-2.5 rounded-xl bg-[#17181c] border border-[#26282f] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                  <Key className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] uppercase tracking-wider text-[#9aa0a6] font-semibold">
                    Active Project & Key
                  </span>
                  <span className="text-xs font-medium text-zinc-200 truncate">
                    {activeProject?.name || activeProjectName || (hasApiKey ? "Custom / AI Studio Key" : "No Project Active")}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {onOpenCustomTabBrowser && (
                  <button
                    type="button"
                    id="drawer-launch-aistudio-btn"
                    onClick={onOpenCustomTabBrowser}
                    className="px-2.5 py-1 rounded-lg bg-[#1f2330] hover:bg-[#282f42] text-blue-300 hover:text-white text-xs font-medium border border-blue-500/30 flex items-center gap-1 transition-colors"
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
                    className="px-2.5 py-1 rounded-lg bg-[#22242c] hover:bg-[#2b2e38] text-zinc-200 hover:text-white text-xs font-medium border border-[#353844] flex items-center gap-1 transition-colors"
                    title="Import or configure project key"
                  >
                    <FolderPlus className="w-3 h-3 text-amber-400" />
                    <span>+ Project</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Project Switcher Selector / Pills in Drawer */}
            {projects.length > 0 && (
              <div className="pt-2 border-t border-[#23252c] space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-zinc-400">
                  <span>Saved Projects ({projects.length})</span>
                  <button
                    type="button"
                    id="drawer-manage-projects-link"
                    onClick={() => {
                      setIsExpanded(false);
                      onOpenSettings("auth");
                    }}
                    className="text-blue-400 hover:underline"
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
                        className={`px-2 py-1 rounded-lg text-xs font-medium shrink-0 transition-colors flex items-center gap-1.5 border ${
                          isSelected
                            ? "bg-blue-600/25 border-blue-500/60 text-white shadow-sm"
                            : "bg-[#1f2128] hover:bg-[#262933] border-[#30333d] text-zinc-300 hover:text-white"
                        }`}
                      >
                        {isSelected ? (
                          <Check className="w-3 h-3 text-blue-400 shrink-0" />
                        ) : (
                          <Key className="w-3 h-3 text-zinc-500 shrink-0" />
                        )}
                        <span className="truncate max-w-[100px]">{proj.name}</span>
                        {proj.apiKey && (
                          <span className="font-mono text-[10px] text-zinc-400">
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
            className="w-full py-1 text-center text-[11px] text-[#9aa0a6] hover:text-white flex items-center justify-center gap-1 border-t border-[#25272e] pt-1.5 transition-colors"
          >
            <ChevronUp className="w-3 h-3" />
            <span>Compress Drawer</span>
          </button>
        </div>
      )}
    </header>
  );
};

