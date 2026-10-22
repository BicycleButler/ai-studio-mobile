import { getSafeNavigatorClipboard } from "../utils/platform";
import React, { useState } from "react";
import { Copy, Check, Terminal, FileCode2, Smartphone, Globe, LucideIcon, Code2 } from "lucide-react";
import { PromptConfig, ChatMessage } from "../types";
import { CodeLangId } from "../services/codeGeneratorService";
import { useServices } from "../services/ServiceContext";

interface CodeExportModalProps {
  config: PromptConfig;
  messages: ChatMessage[];
  isEmbedded?: boolean;
  onOpenMobileIDE?: () => void;
}

export const CodeExportModal: React.FC<CodeExportModalProps> = ({
  config,
  messages,
  isEmbedded = false,
  onOpenMobileIDE,
}) => {
  const [selectedLang, setSelectedLang] = useState<CodeLangId>("kotlin");
  const [copied, setCopied] = useState(false);

  const { codeGeneratorService } = useServices();

  const generator = codeGeneratorService.getGenerator(selectedLang) || codeGeneratorService.getGenerator("kotlin");
  const code = generator?.generate(config, messages) || "";

  const handleCopy = () => {
    getSafeNavigatorClipboard()?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const langs: { id: CodeLangId; label: string; icon: LucideIcon }[] = [
    { id: "kotlin", label: "Android (Kotlin)", icon: Smartphone },
    { id: "typescript", label: "Node / TS", icon: FileCode2 },
    { id: "python", label: "Python", icon: Terminal },
    { id: "curl", label: "cURL", icon: Globe },
  ];

  return (
    <div
      className={`flex flex-col space-y-3 ${
        isEmbedded ? "bg-transparent p-0" : "h-full overflow-y-auto bg-background p-3.5"
      }`}
    >
      {/* Header */}
      <div className="pb-2 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Terminal className="w-4 h-4 text-primary" />
          <span>Get Code for Android & Apps</span>
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Export your prompt, model tuning, and system instructions into ready-to-run code.
        </p>
      </div>

      {/* Language Selector Tabs */}
      <div className="flex rounded-lg bg-muted p-1 border border-border gap-1 overflow-x-auto">
        {langs.map((l) => {
          const Icon = l.icon;
          const isSelected = selectedLang === l.id;
          return (
            <button
              key={l.id}
              onClick={() => setSelectedLang(l.id)}
              className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                isSelected
                  ? "bg-card text-foreground shadow-sm font-semibold border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{l.label}</span>
            </button>
          );
        })}
      </div>

      {/* Code Display Area */}
      <div className="relative bg-muted/30 border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-muted/60 border-b border-border text-[11px] text-muted-foreground">
          <span className="font-mono">{selectedLang}.txt</span>
          <button
            id="copy-code-btn"
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>

        <pre className="p-3 text-[11px] sm:text-xs font-mono text-foreground overflow-x-auto leading-relaxed">
          <code>{code}</code>
        </pre>
      </div>

      {/* Launch in Mobile IDE Action */}
      {onOpenMobileIDE && (
        <button
          id="export-modal-open-ide-btn"
          type="button"
          onClick={onOpenMobileIDE}
          className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl bg-card hover:bg-muted text-foreground border border-border text-xs font-semibold transition-colors shadow-sm cursor-pointer"
        >
          <Code2 className="w-4 h-4 text-primary" />
          <span>Launch Full Mobile IDE (Code Editor & Runner Console)</span>
        </button>
      )}

      {/* Android SDK Note */}
      {selectedLang === "kotlin" && (
        <div className="p-3 rounded-xl bg-card border border-border text-xs text-muted-foreground">
          <div className="font-semibold mb-1 flex items-center gap-1 text-foreground">
            <Smartphone className="w-3.5 h-3.5 text-primary" />
            <span>Android Developer Tip:</span>
          </div>
          Add the Google AI Client SDK to your app module&apos;s <code className="bg-muted px-1 py-0.5 rounded text-foreground font-mono">build.gradle.kts</code> dependencies to run Gemini locally or via streaming in Jetpack Compose.
        </div>
      )}
    </div>
  );
};
