import React from "react";
import { Key, X, ArrowRight } from "lucide-react";
import { useServices } from "../services/ServiceContext";

interface ClipboardKeyBannerProps {
  clipboardToastKey: string | null;
  showImportModal: boolean;
  showCustomTabBrowser: boolean;
  onDismiss: () => void;
  onImport: () => void;
}

export const ClipboardKeyBanner: React.FC<ClipboardKeyBannerProps> = ({
  clipboardToastKey,
  showImportModal,
  showCustomTabBrowser,
  onDismiss,
  onImport,
}) => {
  const { keyVerificationService } = useServices();
  if (!clipboardToastKey || showImportModal || showCustomTabBrowser) {
    return null;
  }

  return (
    <div
      id="clipboard-key-detection-banner"
      className="mx-3 my-2 p-3 rounded-xl bg-gradient-to-r from-blue-950/90 to-indigo-950/90 border border-blue-500/40 text-blue-200 flex items-center justify-between gap-2.5 shadow-lg animate-in slide-in-from-top-2 shrink-0"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
          <Key className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-white">Google API Key Copied</span>
            <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-mono">
              {keyVerificationService.maskApiKey(clipboardToastKey)}
            </span>
          </div>
          <p className="text-[11px] text-zinc-300 truncate">
            Tap to import and activate in this project
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          id="dismiss-clipboard-banner-btn"
          onClick={onDismiss}
          className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          title="Dismiss and wipe clipboard"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          id="import-detected-key-btn"
          onClick={onImport}
          className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1 transition-colors shadow-sm active:scale-95"
        >
          <span>Import</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
