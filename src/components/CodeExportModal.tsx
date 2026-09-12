import React, { useState } from "react";
import { Copy, Check, Terminal, FileCode2, Smartphone, Globe, LucideIcon, Code2 } from "lucide-react";
import { PromptConfig, ChatMessage } from "../types";
import {
  generatePythonCode,
  generateTypeScriptCode,
  generateAndroidKotlinCode,
  generateCurlCode,
} from "../utils/codeGenerators";

interface CodeExportModalProps {
  config: PromptConfig;
  messages: ChatMessage[];
  isEmbedded?: boolean;
  onOpenMobileIDE?: () => void;
}

type CodeLang = "kotlin" | "python" | "typescript" | "curl";

export const CodeExportModal: React.FC<CodeExportModalProps> = ({
  config,
  messages,
  isEmbedded = false,
  onOpenMobileIDE,
}) => {
  const [selectedLang, setSelectedLang] = useState<CodeLang>("kotlin");
  const [copied, setCopied] = useState(false);

  let code = "";
  if (selectedLang === "kotlin") {
    code = generateAndroidKotlinCode(config, messages);
  } else if (selectedLang === "python") {
    code = generatePythonCode(config, messages);
  } else if (selectedLang === "typescript") {
    code = generateTypeScriptCode(config, messages);
  } else {
    code = generateCurlCode(config, messages);
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const langs: { id: CodeLang; label: string; icon: LucideIcon }[] = [
    { id: "kotlin", label: "Android (Kotlin)", icon: Smartphone },
    { id: "typescript", label: "Node / TS", icon: FileCode2 },
    { id: "python", label: "Python", icon: Terminal },
    { id: "curl", label: "cURL", icon: Globe },
  ];

  return (
    <div
      className={`flex flex-col space-y-3 ${
        isEmbedded ? "bg-transparent p-0" : "h-full overflow-y-auto bg-[#131314] p-3.5"
      }`}
    >
      {/* Header */}
      <div className="pb-2 border-b border-[#2b2c31]">
        <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
          <Terminal className="w-4 h-4 text-blue-400" />
          <span>Get Code for Android & Apps</span>
        </h2>
        <p className="text-xs text-[#9aa0a6] mt-0.5">
          Export your prompt, model tuning, and system instructions into ready-to-run code.
        </p>
      </div>

      {/* Language Selector Tabs */}
      <div className="flex rounded-lg bg-[#1a1b1f] p-1 border border-[#2b2c31] gap-1 overflow-x-auto">
        {langs.map((l) => {
          const Icon = l.icon;
          const isSelected = selectedLang === l.id;
          return (
            <button
              key={l.id}
              onClick={() => setSelectedLang(l.id)}
              className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                isSelected
                  ? "bg-[#2b2c31] text-white shadow-sm font-semibold"
                  : "text-[#9aa0a6] hover:text-[#e3e3e3]"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{l.label}</span>
            </button>
          );
        })}
      </div>

      {/* Code Display Area */}
      <div className="relative bg-[#0d0d0f] border border-[#26282f] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-[#17181c] border-b border-[#26282f] text-[11px] text-[#9aa0a6]">
          <span className="font-mono">{selectedLang}.txt</span>
          <button
            id="copy-code-btn"
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-sm transition-colors"
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

        <pre className="p-3 text-[11px] sm:text-xs font-mono text-zinc-300 overflow-x-auto leading-relaxed">
          <code>{code}</code>
        </pre>
      </div>

      {/* Launch in Mobile IDE Action */}
      {onOpenMobileIDE && (
        <button
          id="export-modal-open-ide-btn"
          type="button"
          onClick={onOpenMobileIDE}
          className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-colors shadow-sm active:scale-[0.99]"
        >
          <Code2 className="w-4 h-4 text-amber-400" />
          <span>Launch Full Mobile IDE (Code Editor & Runner Console)</span>
        </button>
      )}

      {/* Android SDK Note */}
      {selectedLang === "kotlin" && (
        <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/25 text-xs text-blue-200">
          <div className="font-semibold mb-1 flex items-center gap-1">
            <Smartphone className="w-3.5 h-3.5 text-blue-400" />
            <span>Android Developer Tip:</span>
          </div>
          Add the Google AI Client SDK to your app module&apos;s <code className="bg-black/40 px-1 py-0.5 rounded text-blue-300">build.gradle.kts</code> dependencies to run Gemini locally or via streaming in Jetpack Compose.
        </div>
      )}
    </div>
  );
};
