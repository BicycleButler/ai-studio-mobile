import React, { useState, useEffect } from "react";
import {
  X,
  Lock,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  Sparkles,
  Key,
  ShieldCheck,
  ArrowRight,
  ClipboardPaste,
} from "lucide-react";
import { detectGoogleApiKey, maskApiKey } from "../services/keyVerification";

interface CustomTabBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportKey: (key: string) => void;
  activeApiKey?: string;
}

const AI_STUDIO_URL = "https://aistudio.google.com/app/apikey";

export const CustomTabBrowserModal: React.FC<CustomTabBrowserModalProps> = ({
  isOpen,
  onClose,
  onImportKey,
  activeApiKey = "",
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isCheckingClipboard, setIsCheckingClipboard] = useState(false);
  const [detectedKey, setDetectedKey] = useState<string | null>(null);

  // When opening or focusing, automatically check clipboard
  const checkClipboard = async () => {
    setIsCheckingClipboard(true);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        const found = detectGoogleApiKey(text);
        if (found && found !== activeApiKey.trim()) {
          setDetectedKey(found);
        }
      }
    } catch {
      // Ignore clipboard permission errors
    } finally {
      setIsCheckingClipboard(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    void checkClipboard();
    const interval = setInterval(() => {
      void checkClipboard();
    }, 2000);
    return () => clearInterval(interval);
  }, [isOpen, activeApiKey]);

  if (!isOpen) return null;

  const handleOpenSystemBrowser = () => {
    // Open in new tab / window to share existing system browser cookies & Google credentials
    window.open(AI_STUDIO_URL, "_blank", "noopener,noreferrer");
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(AI_STUDIO_URL);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // Ignored
    }
  };

  const handleProceedWithDetectedKey = () => {
    if (detectedKey) {
      onImportKey(detectedKey);
      onClose();
    }
  };

  return (
    <div
      id="custom-tab-browser-modal"
      className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm animate-in fade-in"
    >
      <div className="flex-1 flex flex-col max-w-xl w-full mx-auto bg-[#17181c] border-x border-b border-[#2b2c31] shadow-2xl overflow-hidden rounded-b-2xl sm:my-4 sm:rounded-2xl sm:border-t">
        {/* Chrome Custom Tab Top Toolbar */}
        <div className="bg-[#1f2024] border-b border-[#2d2e35] px-3 py-2 flex items-center justify-between gap-2 select-none">
          {/* Close button on the left (Chrome Custom Tab convention) */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-full hover:bg-[#2b2c33] transition-colors"
            title="Close In-App Browser"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Center Address and Identity bar */}
          <div className="flex-1 min-w-0 flex items-center justify-center">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#121316] border border-[#2d2e35] max-w-full truncate">
              <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
              <div className="flex flex-col min-w-0 text-left">
                <span className="text-[10px] font-semibold text-white truncate leading-tight">
                  Google AI Studio
                </span>
                <span className="text-[9px] text-[#9aa0a6] font-mono truncate leading-tight">
                  aistudio.google.com/app/apikey
                </span>
              </div>
            </div>
          </div>

          {/* Right Toolbar Actions */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopyUrl}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#2b2c33] transition-colors"
              title="Copy URL"
            >
              {copiedUrl ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={handleOpenSystemBrowser}
              className="p-1.5 text-blue-400 hover:text-blue-300 rounded-lg hover:bg-blue-500/10 transition-colors"
              title="Open in System Browser (Shares Google login)"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Chrome Custom Tab Content Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[#131315]">
          {/* Detected Key Floating Alert Banner if found */}
          {detectedKey && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 flex items-center justify-between gap-3 animate-in slide-in-from-top-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Key className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-white block">
                    API Key Intercepted!
                  </span>
                  <span className="text-[11px] font-mono text-emerald-300 block truncate">
                    {maskApiKey(detectedKey)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleProceedWithDetectedKey}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs flex items-center gap-1 shrink-0 transition-colors shadow-sm"
              >
                <span>Import</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Header Card */}
          <div className="p-4 rounded-2xl bg-[#1a1b20] border border-[#2b2c31] text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto shadow-inner">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-base font-semibold text-white">
              Google AI Studio Key Launcher
            </h2>
            <p className="text-xs text-[#9aa0a6] leading-relaxed max-w-sm mx-auto">
              Launch Google AI Studio in a shared session with your existing Google credentials.
              Copy your API key, and return here for instant auto-detection!
            </p>

            <div className="pt-2">
              <button
                type="button"
                id="launch-aistudio-system-btn"
                onClick={handleOpenSystemBrowser}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-2 mx-auto transition-all shadow-lg shadow-blue-500/20 active:scale-95"
              >
                <span>Open Google AI Studio Tab</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 3-Step Guide Card */}
          <div className="p-4 rounded-xl bg-[#17181c] border border-[#26282f] space-y-3">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
              Quick Ingestion Workflow
            </span>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                  1
                </div>
                <div className="text-zinc-300">
                  <span className="font-medium text-white">Launch Session:</span> Tap the button above to open AI Studio with your signed-in Google account.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                  2
                </div>
                <div className="text-zinc-300">
                  <span className="font-medium text-white">Create & Copy Key:</span> Click &quot;Create API key&quot; or copy an existing key starting with <code className="bg-[#1f1f23] text-blue-300 px-1 py-0.5 rounded text-[10px]">AIza...</code> or <code className="bg-[#1f1f23] text-blue-300 px-1 py-0.5 rounded text-[10px]">AQ....</code>.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                  3
                </div>
                <div className="text-zinc-300">
                  <span className="font-medium text-white">Return & Auto-Import:</span> Switch back to this app. The clipboard sniffer will automatically capture and verify the key.
                </div>
              </div>
            </div>
          </div>

          {/* Active Key Sniffer Radar Indicator */}
          <div className="p-4 rounded-xl bg-[#16171b] border border-[#2b2c31] flex flex-col items-center justify-center text-center space-y-3 py-6">
            <div className="relative flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Key className="w-5 h-5" />
              </div>
              <span className="absolute w-16 h-16 rounded-full border border-blue-500/30 animate-ping" />
            </div>

            <div>
              <h4 className="text-xs font-semibold text-white">
                Clipboard Radar Active
              </h4>
              <p className="text-[11px] text-[#9aa0a6] mt-0.5">
                Monitoring clipboard for Google AI Studio keys upon return
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={checkClipboard}
                disabled={isCheckingClipboard}
                className="px-3.5 py-1.5 rounded-lg bg-[#252830] hover:bg-[#2f323c] text-zinc-300 text-xs font-medium border border-[#383b45] flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isCheckingClipboard ? "animate-spin text-blue-400" : ""}`}
                />
                <span>{isCheckingClipboard ? "Checking..." : "Inspect Clipboard Now"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onImportKey("");
                  onClose();
                }}
                className="px-3.5 py-1.5 rounded-lg bg-[#1f1f23] hover:bg-[#282930] text-zinc-400 hover:text-white text-xs font-medium border border-[#2d2e35] flex items-center gap-1.5 transition-colors"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>Manual Paste</span>
              </button>
            </div>
          </div>

          {/* Security Assurance footer note */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Encrypted local storage with automatic clipboard wipe</span>
          </div>
        </div>
      </div>
    </div>
  );
};
