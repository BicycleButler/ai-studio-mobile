import { useServices } from "../services/ServiceContext";
import React from "react";
import {
  ExternalLink,
  Smartphone,
  ShieldCheck,
  Download,
  Key,
} from "lucide-react";

interface DesktopWrapperGuideProps {
  onOpenApiKeyModal: () => void;
  isEmbedded?: boolean;
}

export const DesktopWrapperGuide: React.FC<DesktopWrapperGuideProps> = ({
  onOpenApiKeyModal,
  isEmbedded = false,
}) => {
  const { platformService } = useServices();

  const openApiKeyPage = () => {
    platformService.openUrl("https://aistudio.google.com/app/apikey", "_blank");
  };

  return (
    <div
      className={`flex flex-col space-y-4 ${
        isEmbedded ? "bg-transparent p-0" : "h-full overflow-y-auto bg-background p-3.5"
      }`}
    >
      {/* Top Banner */}
      <div className="p-4 rounded-2xl bg-card space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/20 text-primary">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">
              Helm — Mobile Agentic Coding
            </h2>
            <p className="text-xs text-muted-foreground">
              Model-agnostic agentic coding &amp; prompt engineering workspace
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Helm is built from the ground up for mobile software engineering, orchestrating cloud frontier models (Google Gemini, OpenAI, Anthropic, OpenRouter, Groq) and local on-device WebGPU models in a touch-first environment.
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={onOpenApiKeyModal}
            className="flex-1 min-w-[140px] px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-colors cursor-pointer"
          >
            <Key className="w-3.5 h-3.5" />
            <span>Configure Providers</span>
          </button>
          <button
            onClick={openApiKeyPage}
            className="px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Get Gemini Key</span>
            <ExternalLink className="w-3.5 h-3.5 text-primary" />
          </button>
        </div>
      </div>

      {/* Core Mobile Agentic Capabilities */}
      <div className="bg-card rounded-xl p-3.5 space-y-3">
        <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <span>Built for Mobile Agentic Engineering</span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 text-xs">
          <div className="p-2.5 rounded-lg bg-muted/40 flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-muted text-foreground flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold">
              1
            </div>
            <div>
              <strong className="text-foreground block mb-0.5">
                Model-Agnostic Multi-Provider Runtime
              </strong>
              <span className="text-muted-foreground text-[11px] leading-relaxed">
                Switch seamlessly between Google Gemini, OpenAI, Anthropic Claude, OpenRouter, Groq, or run quantized models 100% locally via WebGPU and Ollama.
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-muted/40 flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-muted text-foreground flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold">
              2
            </div>
            <div>
              <strong className="text-foreground block mb-0.5">
                Tactile Mobile IDE &amp; Architecture Graph
              </strong>
              <span className="text-muted-foreground text-[11px] leading-relaxed">
                Inspect live AST dependency graphs, run Stubs architecture audits, edit project files, and execute scripts with sticky virtual-keyboard clearance.
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-muted/40 flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-muted text-foreground flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold">
              3
            </div>
            <div>
              <strong className="text-foreground block mb-0.5">
                Precision Bottom-Sheet Parameter Tuners
              </strong>
              <span className="text-muted-foreground text-[11px] leading-relaxed">
                Fine-tune temperature, Top-P, system directives, and JSON output schemas using thumb-friendly stepped sliders and modular prompt templates.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Android Installation Instructions (PWA) */}
      <div className="bg-card rounded-xl p-3.5 space-y-2.5">
        <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Download className="w-4 h-4 text-primary" />
          <span>How to Install Helm on Your Mobile Device</span>
        </div>

        <ol className="space-y-2 text-xs text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="font-bold text-primary">Step 1:</span>
            <span>Open this URL in <strong>Google Chrome</strong>, <strong>Safari</strong>, or <strong>Samsung Internet</strong> on your phone or tablet.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-primary">Step 2:</span>
            <span>Tap the browser menu button (<strong>⋮ 3 vertical dots</strong> on Android or <strong>Share</strong> on iOS).</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-primary">Step 3:</span>
            <span>Select <strong>&quot;Install app&quot;</strong> or <strong>&quot;Add to Home screen&quot;</strong>.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-primary">Step 4:</span>
            <span>Launch Helm directly from your app drawer or home screen as a native full-screen workspace.</span>
          </li>
        </ol>
      </div>

      {/* Security & Key Config */}
      <div className="p-3 rounded-xl bg-card flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Key className="w-4 h-4 text-primary" />
          <div>
            <span className="text-xs font-semibold text-foreground block">
              Provider API Keys
            </span>
            <span className="text-[11px] text-muted-foreground">
              Encrypted local keys or linked Google AI Studio key
            </span>
          </div>
        </div>
        <button
          onClick={onOpenApiKeyModal}
          className="px-2.5 py-1 text-xs rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer"
        >
          Configure
        </button>
      </div>
    </div>
  );
};
