import React, { useState } from "react";
import { Download, Share, PlusSquare, X, CheckCircle2, Smartphone, Monitor } from "lucide-react";
import { usePWAInstall } from "../hooks/usePWAInstall";

interface PWAInstallButtonProps {
  variant?: "header" | "card" | "banner";
  className?: string;
  onInstalled?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = "header",
  className = "",
  onInstalled,
}) => {
  const { isInstallable, isInstalled, isIOS, isCapacitor, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already installed as PWA or running inside Capacitor native shell, suppress install action
  if (isInstalled || isCapacitor) {
    if (variant === "card") {
      return (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/40 border border-border text-muted-foreground text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            {isCapacitor
              ? "Running in Native Mobile Shell (Capacitor)"
              : "Application is installed and running in standalone PWA mode."}
          </span>
        </div>
      );
    }
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      setIsInstalling(true);
      try {
        const success = await install();
        if (success && onInstalled) {
          onInstalled();
        }
      } finally {
        setIsInstalling(false);
      }
    } else {
      setShowGuide(true);
    }
  };

  // Header button variant (clean toolbar button to the left of workspaces button)
  if (variant === "header") {
    return (
      <>
        <button
          type="button"
          id="pwa-header-install-btn"
          onClick={handleInstallClick}
          disabled={isInstalling}
          className={`p-2.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center justify-center min-w-[44px] min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary touch-manipulation ${className}`}
          title="Install Progressive Web App (PWA)"
          aria-label="Install Progressive Web App (PWA)"
        >
          <Download className="w-4 h-4 text-primary" />
        </button>

        {showGuide && (
          <InstallGuideModal isIOS={isIOS} onClose={() => setShowGuide(false)} />
        )}
      </>
    );
  }

  // Card variant
  if (variant === "card") {
    return (
      <>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Install App on Device</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Install Google AI Studio as a standalone home-screen app with offline caching and native responsiveness.
              </p>
            </div>
          </div>
          <button
            type="button"
            id="pwa-settings-install-btn"
            onClick={handleInstallClick}
            disabled={isInstalling}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-xs font-medium flex items-center justify-center gap-2 cursor-pointer shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary touch-manipulation"
          >
            <Download className="w-4 h-4" />
            <span>{isIOS ? "Install on iOS" : "Install PWA"}</span>
          </button>
        </div>

        {showGuide && (
          <InstallGuideModal isIOS={isIOS} onClose={() => setShowGuide(false)} />
        )}
      </>
    );
  }

  // Banner variant (top or bottom banner)
  return (
    <>
      <div
        id="pwa-install-banner"
        className={`flex items-center justify-between gap-3 p-3 bg-primary/10 border-b border-primary/20 text-foreground text-xs ${className}`}
      >
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-primary shrink-0" />
          <span>Install Google AI Studio for faster launch and offline access.</span>
        </div>
        <button
          type="button"
          onClick={handleInstallClick}
          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition text-xs shrink-0 cursor-pointer"
        >
          {isIOS ? "How to Install" : "Install"}
        </button>
      </div>

      {showGuide && (
        <InstallGuideModal isIOS={isIOS} onClose={() => setShowGuide(false)} />
      )}
    </>
  );
};

interface InstallGuideModalProps {
  isIOS: boolean;
  onClose: () => void;
}

const InstallGuideModal: React.FC<InstallGuideModalProps> = ({ isIOS, onClose }) => {
  return (
    <div
      id="pwa-install-guide-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 shadow-2xl text-foreground">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isIOS ? (
              <Smartphone className="w-5 h-5 text-primary" />
            ) : (
              <Download className="w-5 h-5 text-primary" />
            )}
            <h3 className="text-sm font-semibold text-foreground">
              {isIOS ? "Install on iPhone / iPad" : "Install Progressive Web App"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition flex items-center justify-center cursor-pointer"
            aria-label="Close guide"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          {isIOS
            ? "Safari on iOS installs Progressive Web Apps using the system share menu:"
            : "Install Google AI Studio as a standalone app directly from your browser:"}
        </p>

        <div className="mt-3 space-y-2.5">
          {isIOS ? (
            <>
              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-muted/60 border border-border">
                <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Share className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-foreground">Step 1: Tap Share</span>
                  <p className="text-muted-foreground text-[11px] mt-0.5">
                    Tap the Share icon at the bottom of Safari's toolbar.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-muted/60 border border-border">
                <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <PlusSquare className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-foreground">Step 2: Add to Home Screen</span>
                  <p className="text-muted-foreground text-[11px] mt-0.5">
                    Scroll down in the share sheet and tap "Add to Home Screen".
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-muted/60 border border-border">
                <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Monitor className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-foreground">Step 1: Check Address Bar or Menu</span>
                  <p className="text-muted-foreground text-[11px] mt-0.5">
                    Look for the Install icon (computer with down arrow) in the browser address bar, or click the browser menu (⋮).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-muted/60 border border-border">
                <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Download className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-foreground">Step 2: Select Install</span>
                  <p className="text-muted-foreground text-[11px] mt-0.5">
                    Choose "Install Google AI Studio" or "Add to Home screen" to install as a standalone application.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition cursor-pointer"
        >
          Got It
        </button>
      </div>
    </div>
  );
};
