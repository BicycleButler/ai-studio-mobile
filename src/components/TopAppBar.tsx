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
} from "lucide-react";
import { PromptType, GoogleUser } from "../types";
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
}) => {
  // Expandable drawer tucked away by default to clean up space
  const [isExpanded, setIsExpanded] = useState(false);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
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
    <header className="sticky top-0 z-30 bg-[#131314]/95 backdrop-blur-md border-b border-[#2b2c31] px-3 py-2 transition-all">
      {/* Top Bar Row: Sparkle Icon (Top Left Corner) & Menu / Tokens (Right) */}
      <div className="flex items-center justify-between gap-3">
        {/* Top Left Corner: Sparkle Icon button to expand or compress the drawer */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            id="sparkle-drawer-toggle-btn"
            onClick={() => setIsExpanded((prev) => !prev)}
            className={`flex items-center gap-1.5 p-1.5 px-2 rounded-xl border transition-all ${
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
              <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-1 ring-[#131314]" />
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
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1a1b20] hover:bg-[#25272e] text-[#e3e3e3] hover:text-white border border-[#2b2d35] hover:border-[#383b45] text-xs font-semibold shadow-sm transition-all active:scale-[0.98] group cursor-pointer"
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
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-all ${
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
                                <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono font-semibold">
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
        </div>

        {/* Right: Google Account, Token Counter Visualization & Hamburger Menu Icon */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Google Account Profile or Sign In button */}
          {googleUser ? (
            <button
              type="button"
              id="header-google-account-btn"
              onClick={() => onOpenSettings("auth")}
              className="flex items-center gap-1.5 p-1 sm:px-2 sm:py-1 rounded-full bg-[#1b1f2e] hover:bg-[#252b3e] border border-blue-500/30 text-white transition-all group shadow-sm"
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
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-[#1b1f2e]" />
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
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white hover:bg-zinc-100 text-[#1f1f23] text-xs font-semibold shadow-sm transition-all active:scale-95"
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
            className="p-2 rounded-lg bg-[#1f1f23] hover:bg-[#2b2c31] text-[#c4c7c5] hover:text-white border border-[#2b2c31] transition-all relative group"
            title="Menu (Tune, Library, Get Code, Companion, Audio, Settings)"
            aria-label="Open menu"
          >
            <Menu className="w-4 h-4 transition-transform duration-150 group-active:scale-95" />
            {!hasApiKey && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-[#1f1f23]" />
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
              <span className="text-sm font-semibold tracking-tight text-white leading-tight">
                Google AI Studio
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                Playground
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
                  className="w-full text-xs bg-[#1f1f23] border border-[#2f3136] rounded-lg p-2 text-[#e3e3e3] placeholder-[#71767b] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none pr-8"
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

