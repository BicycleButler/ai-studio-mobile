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
} from "lucide-react";
import { PromptType } from "../types";
import { SettingsTab } from "./UnifiedSettingsModal";
import { useSpeechToText } from "../hooks/useSpeechToText";
import { TokenCounterVisualization } from "./TokenCounterVisualization";

interface TopAppBarProps {
  promptType: PromptType;
  onSelectPromptType: (type: PromptType) => void;
  currentModelName: string;
  onOpenParameters: () => void;
  onOpenSettings: (tab?: SettingsTab) => void;
  hasApiKey: boolean;
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
  totalTokens = 0,
  maxTokens = 1_000_000,
  systemInstruction = "",
  onUpdateSystemInstruction,
}) => {
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

          {/* Collapsed state indicator: minimal subtle hint if not expanded */}
          {!isExpanded && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] text-[#71767b] font-medium truncate capitalize">
                {promptType}
              </span>
              {systemInstruction ? (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                  title="Active system instructions"
                />
              ) : null}
            </div>
          )}
        </div>

        {/* Right: Token Counter Visualization & Hamburger Menu Icon */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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

          {/* 3. The Three buttons to switch between chat, prompt freeform, and structured */}
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-[#9aa0a6] font-semibold mb-1">
              Prompt Mode
            </span>
            <div className="flex rounded-lg bg-[#1a1a1c] p-0.5 border border-[#2b2c31]">
              <button
                type="button"
                id="mode-tab-chat"
                onClick={() => onSelectPromptType("chat")}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                  promptType === "chat"
                    ? "bg-[#2b2c31] text-white shadow-sm"
                    : "text-[#9aa0a6] hover:text-[#e3e3e3]"
                }`}
              >
                Chat Prompt
              </button>
              <button
                type="button"
                id="mode-tab-freeform"
                onClick={() => onSelectPromptType("freeform")}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                  promptType === "freeform"
                    ? "bg-[#2b2c31] text-white shadow-sm"
                    : "text-[#9aa0a6] hover:text-[#e3e3e3]"
                }`}
              >
                Freeform
              </button>
              <button
                type="button"
                id="mode-tab-structured"
                onClick={() => onSelectPromptType("structured")}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                  promptType === "structured"
                    ? "bg-[#2b2c31] text-white shadow-sm"
                    : "text-[#9aa0a6] hover:text-[#e3e3e3]"
                }`}
              >
                Structured
              </button>
            </div>
          </div>

          {/* 4. System Instructions Drawer */}
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

