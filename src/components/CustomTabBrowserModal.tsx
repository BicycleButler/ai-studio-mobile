import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
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
  Bot,
  ArrowLeft,
} from "lucide-react";
import { useServices } from "../services/ServiceContext";
import { useBackNavigation } from "../hooks/useBackNavigation";
import { getSafeWindow } from "../utils/platform";

export type CredentialTargetService = "aistudio" | "jules";

interface CustomTabBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportKey: (key: string, service?: CredentialTargetService) => void;
  activeApiKey?: string;
  initialService?: CredentialTargetService;
}

const AI_STUDIO_URL = "https://aistudio.google.com/app/apikey";
const JULES_SETTINGS_URL = "https://jules.google.com/settings";

export const CustomTabBrowserModal: React.FC<CustomTabBrowserModalProps> = ({
  isOpen,
  onClose,
  onImportKey,
  activeApiKey = "",
  initialService = "aistudio",
}) => {
  const { keyVerificationService, clipboardService } = useServices();

  // Enable device/browser back navigation to dismiss browser smoothly
  useBackNavigation(isOpen, onClose, "custom-tab-browser");

  const [activeService, setActiveService] = useState<CredentialTargetService>(initialService);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isCheckingClipboard, setIsCheckingClipboard] = useState(false);
  const [detectedKey, setDetectedKey] = useState<string | null>(null);

  useEffect(() => {
    if (initialService) {
      setActiveService(initialService);
    }
  }, [initialService, isOpen]);

  const targetUrl = activeService === "jules" ? JULES_SETTINGS_URL : AI_STUDIO_URL;
  const isJules = activeService === "jules";

  // When opening or focusing, automatically check clipboard
  const checkClipboard = async () => {
    setIsCheckingClipboard(true);
    try {
      const text = await clipboardService.readText();
      if (text) {
          const found = isJules ? (keyVerificationService.detectJulesApiKey(text) || keyVerificationService.detectGoogleApiKey(text)) : keyVerificationService.detectGoogleApiKey(text);
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

  const { platformService } = useServices();

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    void checkClipboard();
    const interval = platformService.setInterval(() => {
      void checkClipboard();
    }, 2000);
    return () => platformService.clearInterval(interval as unknown as number);
  }, [isOpen, activeApiKey, activeService, platformService]);

  const handleOpenSystemBrowser = () => {
    getSafeWindow()?.open(targetUrl, "_blank", "noopener,noreferrer");
  };

  const handleCopyUrl = async () => {
    try {
      await clipboardService.writeText(targetUrl);
      setCopiedUrl(true);
      platformService.setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // Ignored
    }
  };

  const handleProceedWithDetectedKey = () => {
    if (detectedKey) {
      onImportKey(detectedKey, activeService);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="custom-tab-browser-modal"
          id="custom-tab-browser-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.27, ease: "easeOut" }}
          className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            key="custom-tab-browser-dialog"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.27, ease: [0.32, 0.72, 0, 1] }}
            className="flex-1 flex flex-col max-w-xl w-full mx-auto bg-card border-x border-b border-border shadow-2xl overflow-hidden rounded-b-2xl sm:my-4 sm:rounded-2xl sm:border-t"
          >
        {/* Chrome Custom Tab Top Toolbar */}
        <div className="bg-muted border-b border-border px-3 py-2 flex items-center justify-between gap-2 select-none">
          {/* Back button on the left */}
          <button
            type="button"
            id="custom-tab-back-btn"
            onClick={onClose}
            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/80 transition-colors cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title="Back / Close"
            aria-label="Back"
          >
            <ArrowLeft className="rtl:rotate-180 w-5 h-5" />
          </button>

          {/* Center Address and Identity bar */}
          <div className="flex-1 min-w-0 flex items-center justify-center">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-card border border-border max-w-full truncate">
              <Lock className="w-3 h-3 text-primary shrink-0" />
              <div className="flex flex-col min-w-0 text-start">
                <span className="text-[10px] font-semibold text-foreground truncate leading-tight">
                  {isJules ? "Google Jules Agent" : "Google AI Studio"}
                </span>
                <span className="text-[9px] text-muted-foreground font-mono truncate leading-tight">
                  {isJules ? "jules.google.com/settings" : "aistudio.google.com/app/apikey"}
                </span>
              </div>
            </div>
          </div>

          {/* Right Toolbar Actions */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopyUrl}
              className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors cursor-pointer touch-manipulation"
              title="Copy URL"
            >
              {copiedUrl ? (
                <Check className="w-4 h-4 text-primary" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={handleOpenSystemBrowser}
              className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-primary hover:text-primary/80 rounded-xl hover:bg-muted transition-colors cursor-pointer touch-manipulation"
              title="Open in System Browser"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              type="button"
              id="custom-tab-close-btn"
              onClick={onClose}
              className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title="Close browser"
              aria-label="Close browser"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Service Switcher Tabs */}
        <div className="px-4 pt-3 pb-1 border-b border-border flex items-center gap-2 bg-card">
          <button
            type="button"
            onClick={() => {
              setActiveService("aistudio");
              setDetectedKey(null);
            }}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              !isJules
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Google AI Studio</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveService("jules");
              setDetectedKey(null);
            }}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              isJules
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Google Jules</span>
          </button>
        </div>

        {/* Chrome Custom Tab Content Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-background">
          {/* Detected Key Floating Alert Banner if found */}
          {detectedKey && (
            <div className="p-3.5 rounded-xl bg-card border border-primary/40 text-foreground flex items-center justify-between gap-3 animate-in slide-in-from-top-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0">
                  <Key className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-foreground block">
                    {isJules ? "Jules API Key Intercepted!" : "AI Studio Key Intercepted!"}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground block truncate">
                    {keyVerificationService.maskApiKey(detectedKey)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleProceedWithDetectedKey}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1 shrink-0 transition-colors shadow-sm cursor-pointer"
              >
                <span>Import Key</span>
                <ArrowRight className="rtl:rotate-180 w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Header Card */}
          <div className="p-4 rounded-2xl bg-card border border-border text-center space-y-2">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto shadow-inner ${
                isJules
                  ? "bg-primary/15 border border-primary/30 text-primary"
                  : "bg-primary/15 border border-primary/30 text-primary"
              }`}
            >
              {isJules ? <Bot className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
            </div>
            <h2 className="text-base font-semibold text-foreground">
              {isJules ? "Google Jules Key Ingestion" : "Google AI Studio Key Launcher"}
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
              {isJules
                ? "Open Jules settings at jules.google.com/settings to view or generate your personal API Key. Copy your key and return here for instant auto-detection!"
                : "Launch Google AI Studio in a shared session with your existing Google credentials. Copy your API key, and return here for instant auto-detection!"}
            </p>

            <div className="pt-2">
              <button
                type="button"
                id="launch-aistudio-system-btn"
                onClick={handleOpenSystemBrowser}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 mx-auto transition-colors shadow-lg active:scale-95 bg-primary text-primary-foreground cursor-pointer"
              >
                <span>{isJules ? "Open Google Jules Settings Tab" : "Open Google AI Studio Tab"}</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 3-Step Guide Card */}
          <div className="p-4 rounded-xl bg-card border border-border space-y-3">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              {isJules ? "Jules Credential Flow" : "Quick Ingestion Workflow"}
            </span>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-start gap-3">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 bg-primary/20 text-primary"
                >
                  1
                </div>
                <div className="text-muted-foreground">
                  <span className="font-medium text-foreground">Open Settings:</span>{" "}
                  {isJules
                    ? "Tap the button above to navigate to jules.google.com/settings."
                    : "Tap the button above to open AI Studio with your signed-in Google account."}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 bg-primary/20 text-primary"
                >
                  2
                </div>
                <div className="text-muted-foreground">
                  <span className="font-medium text-foreground">Copy API Key:</span>{" "}
                  {isJules
                    ? "Under 'API Key', copy your key (single key covers all authorized GitHub repos)."
                    : "Click 'Create API key' or copy an existing key starting with AIza... or AQ...."}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 bg-primary/20 text-primary"
                >
                  3
                </div>
                <div className="text-muted-foreground">
                  <span className="font-medium text-foreground">Return & Auto-Import:</span> Switch back to this app. The clipboard radar will detect and load your key automatically.
                </div>
              </div>
            </div>
          </div>

          {/* Active Key Sniffer Radar Indicator */}
          <div className="p-4 rounded-xl bg-card border border-border flex flex-col items-center justify-center text-center space-y-3 py-6">
            <div className="relative flex items-center justify-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center bg-primary/10 border border-primary/30 text-primary"
              >
                <Key className="w-5 h-5" />
              </div>
              <span
                className="absolute w-16 h-16 rounded-full border border-primary/30 animate-ping"
              />
            </div>

            <div>
              <h4 className="text-xs font-semibold text-foreground">
                Clipboard Radar Active
              </h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Monitoring clipboard for {isJules ? "Google Jules" : "Google AI Studio"} keys upon return
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={checkClipboard}
                disabled={isCheckingClipboard}
                className="px-3.5 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-xs font-medium border border-border flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    isCheckingClipboard
                      ? "animate-spin text-primary"
                      : ""
                  }`}
                />
                <span>{isCheckingClipboard ? "Checking..." : "Inspect Clipboard Now"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onImportKey("", activeService);
                  onClose();
                }}
                className="px-3.5 py-1.5 rounded-lg bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium border border-border flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>Manual Paste</span>
              </button>
            </div>
          </div>

          {/* Security Assurance footer note */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>Encrypted local storage with automatic clipboard wipe</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
    )}
  </AnimatePresence>
  );
};

