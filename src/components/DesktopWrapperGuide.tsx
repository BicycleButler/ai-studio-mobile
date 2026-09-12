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
  const openDesktopAiStudio = () => {
    window.open("https://aistudio.google.com", "_blank", "noopener,noreferrer");
  };

  const openApiKeyPage = () => {
    window.open(
      "https://aistudio.google.com/app/apikey",
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div
      className={`flex flex-col space-y-4 ${
        isEmbedded ? "bg-transparent p-0" : "h-full overflow-y-auto bg-[#131314] p-3.5"
      }`}
    >
      {/* Top Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-950/40 via-[#1b1d24] to-[#17181c] border border-blue-500/30 space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">
              Google AI Studio Android Client
            </h2>
            <p className="text-xs text-blue-300">
              Desktop wrapper & touch-optimized mobile workspace
            </p>
          </div>
        </div>

        <p className="text-xs text-[#c4c7c5] leading-relaxed">
          Google AI Studio was built primarily for desktop multi-monitor monitors. This application solves mobile friction by redesigning the entire prompt engineering workflow for Android screens.
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={openDesktopAiStudio}
            className="flex-1 min-w-[140px] px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-colors"
          >
            <span>Open Desktop Site</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={openApiKeyPage}
            className="px-3 py-2 rounded-xl bg-[#252830] hover:bg-[#2e313b] text-zinc-200 text-xs font-medium flex items-center gap-1.5 border border-[#383b45] transition-colors"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span>Get API Key</span>
          </button>
        </div>
      </div>

      {/* Why a specialized mobile wrapper is required */}
      <div className="bg-[#17181c] border border-[#27292f] rounded-xl p-3.5 space-y-3">
        <div className="text-xs font-semibold text-white flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Why Desktop AI Studio Needs This Mobile Wrapper</span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 text-xs">
          <div className="p-2.5 rounded-lg bg-[#1e2025] border border-[#2c2e35] flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-muted/60 text-zinc-300 flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold">
              1
            </div>
            <div>
              <strong className="text-white block mb-0.5">
                Cramped Sidebars & Cutoffs
              </strong>
              <span className="text-[#9aa0a6] text-[11px] leading-relaxed">
                Desktop AI Studio pins a 300px parameter inspector and 240px navigation drawer. On a 390px mobile screen, there is virtually zero space left for the prompt text area. This app moves parameters into a tactile Android bottom sheet.
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-[#1e2025] border border-[#2c2e35] flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-muted/60 text-zinc-300 flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold">
              2
            </div>
            <div>
              <strong className="text-white block mb-0.5">
                On-Screen Virtual Keyboard Handling
              </strong>
              <span className="text-[#9aa0a6] text-[11px] leading-relaxed">
                Opening Gboard on mobile hides the Run button on desktop web. This client provides sticky keyboard clearance so you can type and execute prompts with one thumb.
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-[#1e2025] border border-[#2c2e35] flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-muted/60 text-zinc-300 flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold">
              3
            </div>
            <div>
              <strong className="text-white block mb-0.5">
                Touch-Target Friendly Sliders & Buttons
              </strong>
              <span className="text-[#9aa0a6] text-[11px] leading-relaxed">
                Fine tuning temperature (e.g. 0.35) or Top-P on desktop web is notoriously difficult with finger drag. Our sliders feature high-precision stepped thumb controls and instant visual feedback.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Android Installation Instructions (PWA) */}
      <div className="bg-[#17181c] border border-[#27292f] rounded-xl p-3.5 space-y-2.5">
        <div className="text-xs font-semibold text-white flex items-center gap-1.5">
          <Download className="w-4 h-4 text-blue-400" />
          <span>How to Install on Your Android Device</span>
        </div>

        <ol className="space-y-2 text-xs text-[#c4c7c5]">
          <li className="flex items-start gap-2">
            <span className="font-bold text-blue-400">Step 1:</span>
            <span>Open this URL in <strong>Google Chrome</strong> or <strong>Samsung Internet</strong> on your Android phone or tablet.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-blue-400">Step 2:</span>
            <span>Tap the browser menu button (<strong>⋮ 3 vertical dots</strong> in top-right corner).</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-blue-400">Step 3:</span>
            <span>Select <strong>&quot;Install app&quot;</strong> or <strong>&quot;Add to Home screen&quot;</strong>.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-blue-400">Step 4:</span>
            <span>Launch it directly from your Android app drawer or home screen as a native full-screen app!</span>
          </li>
        </ol>
      </div>

      {/* Security & Key Config */}
      <div className="p-3 rounded-xl bg-[#1a1b20] border border-[#2c2e35] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Key className="w-4 h-4 text-amber-400" />
          <div>
            <span className="text-xs font-semibold text-white block">
              Gemini API Key
            </span>
            <span className="text-[11px] text-[#9aa0a6]">
              Configured via Cloud Run server or custom key
            </span>
          </div>
        </div>
        <button
          onClick={onOpenApiKeyModal}
          className="px-2.5 py-1 text-xs rounded-lg bg-[#252830] hover:bg-[#2f323c] text-zinc-200 border border-[#383b45] transition-colors"
        >
          Configure
        </button>
      </div>
    </div>
  );
};
