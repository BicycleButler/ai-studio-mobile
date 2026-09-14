import React, { useState, useRef } from "react";
import { Play, Variable, Square, Copy, Check, Mic } from "lucide-react";
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
    <div className="flex flex-col h-full flex-1 overflow-y-auto bg-background text-foreground p-3 space-y-3">
      {/* Header Info Banner */}
      <div className="flex items-center justify-between text-xs bg-card border border-border rounded-xl px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">Freeform Prompt Canvas</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => insertVariable("variable")}
            className="px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 text-foreground text-[11px] flex items-center gap-1 border border-border cursor-pointer transition-colors"
          >
            <Variable className="w-3 h-3 text-primary" />
            <span>+ Variable</span>
          </button>
        </div>
      </div>

      {/* Editor Box */}
      <div className="flex flex-col bg-card border border-border rounded-xl p-2.5 focus-within:border-primary transition-colors">
        <label className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span>Prompt Content</span>
            <span className="text-[10px] text-muted-foreground">Supports &#123;&#123;variables&#125;&#125;</span>
          </div>
          <button
            type="button"
            onClick={handleActivateSpeech}
            className={`p-1 rounded text-xs transition-colors flex items-center gap-1 cursor-pointer ${
              isListening
                ? "bg-primary text-primary-foreground animate-pulse"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
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
          className="w-full bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none font-mono leading-relaxed"
        />
      </div>

      {/* Variables Input Drawer if any {{var}} present */}
      {detectedVars.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-3 space-y-2">
          <div className="text-[11px] font-semibold text-foreground flex items-center gap-1">
            <Variable className="w-3.5 h-3.5 text-primary" />
            <span>Test Variable Values</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {detectedVars.map((v) => (
              <div key={v} className="flex flex-col">
                <span className="text-[10px] font-mono text-primary mb-0.5">
                  {`{{${v}}}`}
                </span>
                <input
                  type="text"
                  value={variables[v] || ""}
                  onChange={(e) =>
                    setVariables((prev) => ({ ...prev, [v]: e.target.value }))
                  }
                  placeholder={`Value for ${v}...`}
                  className="bg-background border border-border rounded-lg px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[11px] text-muted-foreground font-mono">
          Model: {config.model}
        </span>
        {isGenerating ? (
          <button
            onClick={onStop}
            className="px-4 py-2 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-semibold flex items-center gap-1.5 shadow-md active:scale-95 transition-colors cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Stop</span>
          </button>
        ) : (
          <button
            id="freeform-run-btn"
            onClick={handleRun}
            disabled={!freeformText.trim()}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md active:scale-95 transition-colors cursor-pointer ${
              freeformText.trim()
                ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Run Prompt</span>
          </button>
        )}
      </div>

      {/* Response Panel */}
      <div className="flex flex-col bg-card border border-border rounded-xl p-3 min-h-[160px]">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-foreground">Model Output</span>
            {tokens ? (
              <span className="text-[10px] text-muted-foreground">• {tokens} tokens</span>
            ) : null}
            {durationMs ? (
              <span className="text-[10px] text-muted-foreground">
                • {(durationMs / 1000).toFixed(2)}s
              </span>
            ) : null}
          </div>
          {output && (
            <button
              onClick={handleCopy}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Copy output"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-primary" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        {output ? (
          <div className="prose dark:prose-invert prose-xs sm:prose-sm max-w-none break-words text-foreground [&>pre]:bg-muted [&>pre]:p-3 [&>pre]:rounded-xl [&>pre]:border [&>pre]:border-border [&>code]:text-primary">
            <Markdown>{output}</Markdown>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground italic py-6">
            {isGenerating ? "Streaming Gemini response..." : "Response will appear here after clicking Run."}
          </div>
        )}
      </div>

      {/* Sticky Footer Button for Freeform Prompt Instructions Area */}
      <div className="sticky bottom-0 z-20 -mx-3 -mb-3 px-3 py-2 bg-background/95 backdrop-blur border-t border-border shadow-lg">
        <button
          type="button"
          id="freeform-sticky-mic-btn"
          onClick={handleActivateSpeech}
          className={`w-full py-2.5 px-4 rounded-xl font-medium text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-colors shadow-md active:scale-[0.99] cursor-pointer ${
            isListening
              ? "bg-primary text-primary-foreground animate-pulse"
              : "bg-primary hover:bg-primary/90 text-primary-foreground"
          }`}
          title="Activate keyboard microphone for speech-to-text in prompt instructions area"
          aria-label="Speech to text keyboard microphone"
        >
          {isListening ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-current"></span>
              </span>
              <Mic className="w-4 h-4 animate-pulse text-current" />
              <span className="font-semibold">Listening... Tap to stop (or use keyboard mic)</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4 text-current" />
              <span className="font-semibold">Speech-to-Text / Keyboard Mic</span>
              <span className="text-[11px] opacity-90 hidden xs:inline font-normal">
                (Dictate prompt instructions)
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
