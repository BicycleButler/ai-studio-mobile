import React, { useState, useRef } from "react";
import { Play, Sparkles, Variable, Square, Copy, Check, Mic } from "lucide-react";
import Markdown from "react-markdown";
import { PromptConfig } from "../types";
import { useSpeechToText } from "../hooks/useSpeechToText";

interface FreeformWorkspaceProps {
  config: PromptConfig;
  freeformText: string;
  onChangeText: (text: string) => void;
  onExecute: (text: string) => void;
  onStop: () => void;
  isGenerating: boolean;
  output: string;
  durationMs?: number;
  tokens?: number;
}

export const FreeformWorkspace: React.FC<FreeformWorkspaceProps> = ({
  config,
  freeformText,
  onChangeText,
  onExecute,
  onStop,
  isGenerating,
  output,
  durationMs,
  tokens,
}) => {
  const [copied, setCopied] = useState(false);
  const [variables, setVariables] = useState<Record<string, string>>({
    topic: "Mobile Jetpack Compose UX",
    audience: "Android Engineers",
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const speechBaseTextRef = useRef<string>("");

  const {
    isListening,
    startListening,
    stopListening,
  } = useSpeechToText({
    onTranscript: (chunk) => {
      const base = speechBaseTextRef.current;
      const sep = base && !base.endsWith(" ") ? " " : "";
      onChangeText(base ? `${base}${sep}${chunk}` : chunk);
    },
  });

  const handleActivateSpeech = () => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
      textareaRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    if (isListening) {
      stopListening();
    } else {
      speechBaseTextRef.current = freeformText;
      startListening();
    }
  };

  // Find all {{var_name}} in text
  const detectedVars = Array.from(
    new Set(
      Array.from(freeformText.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)).map(
        (m) => m[1]
      )
    )
  );

  const handleRun = () => {
    let populatedText = freeformText;
    for (const [key, val] of Object.entries(variables)) {
      populatedText = populatedText.replaceAll(`{{${key}}}`, val || "");
    }
    onExecute(populatedText);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const insertVariable = (varName: string) => {
    onChangeText(`${freeformText} {{${varName}}}`);
  };

  return (
    <div className="flex flex-col h-full flex-1 overflow-y-auto bg-[#131314] p-3 space-y-3">
      {/* Header Info Banner */}
      <div className="flex items-center justify-between text-xs bg-[#1a1b1f] border border-[#2b2c31] rounded-xl px-3 py-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-medium text-white">Freeform Prompt Canvas</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => insertVariable("variable")}
            className="px-2 py-0.5 rounded-md bg-[#25272e] hover:bg-[#2e313a] text-blue-300 text-[11px] flex items-center gap-1 border border-[#353842]"
          >
            <Variable className="w-3 h-3" />
            <span>+ Variable</span>
          </button>
        </div>
      </div>

      {/* Editor Box */}
      <div className="flex flex-col bg-[#1a1b20] border border-[#2c2e35] rounded-xl p-2.5 focus-within:border-blue-500 transition-colors">
        <label className="text-[11px] font-medium text-[#9aa0a6] mb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span>Prompt Content</span>
            <span className="text-[10px] text-zinc-500">Supports &#123;&#123;variables&#125;&#125;</span>
          </div>
          <button
            type="button"
            onClick={handleActivateSpeech}
            className={`p-1 rounded text-xs transition-colors flex items-center gap-1 ${
              isListening
                ? "bg-rose-600 text-white animate-pulse"
                : "text-zinc-400 hover:text-white hover:bg-[#25272e]"
            }`}
            title="Speech-to-text / Keyboard microphone"
          >
            <Mic className="w-3.5 h-3.5" />
            <span className="text-[10px]">{isListening ? "Listening..." : "Dictate"}</span>
          </button>
        </label>
        <textarea
          ref={textareaRef}
          id="freeform-prompt-textarea"
          value={freeformText}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder="Enter prompt instructions... Example: Write a short technical summary about {{topic}} for {{audience}}."
          rows={6}
          className="w-full bg-transparent text-xs sm:text-sm text-[#e3e3e3] placeholder-[#71767b] focus:outline-none resize-none font-mono leading-relaxed"
        />
      </div>

      {/* Variables Input Drawer if any {{var}} present */}
      {detectedVars.length > 0 && (
        <div className="bg-[#17181c] border border-[#27292f] rounded-xl p-3 space-y-2">
          <div className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1">
            <Variable className="w-3.5 h-3.5 text-blue-400" />
            <span>Test Variable Values</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {detectedVars.map((v) => (
              <div key={v} className="flex flex-col">
                <span className="text-[10px] font-mono text-blue-300 mb-0.5">
                  {`{{${v}}}`}
                </span>
                <input
                  type="text"
                  value={variables[v] || ""}
                  onChange={(e) =>
                    setVariables((prev) => ({ ...prev, [v]: e.target.value }))
                  }
                  placeholder={`Value for ${v}...`}
                  className="bg-[#202127] border border-[#30333d] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[11px] text-[#71767b] font-mono">
          Model: {config.model}
        </span>
        {isGenerating ? (
          <button
            onClick={onStop}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md active:scale-95 transition-colors"
          >
            <Square className="w-3.5 h-3.5 fill-white" />
            <span>Stop</span>
          </button>
        ) : (
          <button
            id="freeform-run-btn"
            onClick={handleRun}
            disabled={!freeformText.trim()}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md active:scale-95 transition-colors ${
              freeformText.trim()
                ? "bg-blue-600 hover:bg-blue-500 text-white"
                : "bg-[#25272e] text-zinc-500 cursor-not-allowed"
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Run Prompt</span>
          </button>
        )}
      </div>

      {/* Response Panel */}
      <div className="flex flex-col bg-[#1a1b20] border border-[#2c2e35] rounded-xl p-3 min-h-[160px]">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#292b31] text-[11px] text-[#9aa0a6]">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-semibold text-zinc-300">Model Output</span>
            {tokens ? (
              <span className="text-[10px] text-zinc-500">• {tokens} tokens</span>
            ) : null}
            {durationMs ? (
              <span className="text-[10px] text-zinc-500">
                • {(durationMs / 1000).toFixed(2)}s
              </span>
            ) : null}
          </div>
          {output && (
            <button
              onClick={handleCopy}
              className="p-1 rounded text-[#9aa0a6] hover:text-white hover:bg-[#25272e] transition-colors"
              title="Copy output"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        {output ? (
          <div className="prose prose-invert prose-xs sm:prose-sm max-w-none break-words [&>pre]:bg-[#121214] [&>pre]:p-3 [&>pre]:rounded-xl [&>pre]:border [&>pre]:border-[#2c2d33] [&>code]:text-blue-300">
            <Markdown>{output}</Markdown>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-zinc-500 italic py-6">
            {isGenerating ? "Streaming Gemini response..." : "Response will appear here after clicking Run."}
          </div>
        )}
      </div>

      {/* Sticky Footer Button for Freeform Prompt Instructions Area */}
      <div className="sticky bottom-0 z-20 -mx-3 -mb-3 px-3 py-2 bg-[#121316]/95 backdrop-blur border-t border-[#26282e] shadow-lg">
        <button
          type="button"
          id="freeform-sticky-mic-btn"
          onClick={handleActivateSpeech}
          className={`w-full py-2.5 px-4 rounded-xl font-medium text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-colors shadow-md active:scale-[0.99] ${
            isListening
              ? "bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-400/50 shadow-rose-600/30"
              : "bg-gradient-to-r from-blue-600/90 to-indigo-600/90 hover:from-blue-600 hover:to-indigo-600 text-white border border-blue-500/40 shadow-blue-500/20"
          }`}
          title="Activate keyboard microphone for speech-to-text in prompt instructions area"
          aria-label="Speech to text keyboard microphone"
        >
          {isListening ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
              </span>
              <Mic className="w-4 h-4 animate-pulse text-white" />
              <span className="font-semibold text-white">Listening... Tap to stop (or use keyboard mic)</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4 text-white" />
              <span className="font-semibold text-white">Speech-to-Text / Keyboard Mic</span>
              <span className="text-[11px] text-blue-100/85 hidden xs:inline font-normal">
                (Dictate prompt instructions)
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
