import React from "react";
import { AlertCircle, AlertTriangle, Key, RefreshCw, X, ExternalLink } from "lucide-react";

interface StreamErrorBannerProps {
  streamError: string | null;
  errorDetails?: {
    isKeyInvalid?: boolean;
    isAuthError?: boolean;
    isQuotaError?: boolean;
    isUnavailable?: boolean;
  } | null;
  activeProjectStatus?: string;
  onClearError: () => void;
  onUpdateInAIStudio: () => void;
  onFixKey: () => void;
  onTryLite: () => void;
  onRetry: () => void;
}

export const StreamErrorBanner: React.FC<StreamErrorBannerProps> = ({
  streamError,
  errorDetails,
  activeProjectStatus,
  onClearError,
  onUpdateInAIStudio,
  onFixKey,
  onTryLite,
  onRetry,
}) => {
  if (!streamError) {
    return null;
  }

  const isInvalidKey = errorDetails?.isKeyInvalid || activeProjectStatus === "invalid_key";

  return (
    <div
      className={`border-b px-3 py-2 text-xs flex items-center justify-between gap-2 shrink-0 ${
        isInvalidKey
          ? "bg-muted border-border text-foreground"
          : "bg-muted border-border text-foreground /* error */"
      }`}
    >
      <div className="flex items-center gap-2 overflow-hidden">
        {isInvalidKey ? (
          <AlertTriangle className="w-4 h-4 text-zinc-400 shrink-0 animate-pulse" />
        ) : (
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
        )}
        <span className="truncate">
          {isInvalidKey
            ? "API key expired or revoked — Update API Key in AI Studio to resume requests."
            : streamError}
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {isInvalidKey ? (
          <button
            type="button"
            id="banner-update-ai-studio-btn"
            onClick={onUpdateInAIStudio}
            className="px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-black font-semibold flex items-center gap-1 text-[11px] shadow-sm transition"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Update in AI Studio</span>
          </button>
        ) : errorDetails?.isAuthError ? (
          <button
            onClick={onFixKey}
            className="px-2 py-0.5 rounded bg-rose-800 hover:bg-rose-700 text-rose-100 font-medium flex items-center gap-1 text-[11px]"
          >
            <Key className="w-3 h-3" /> Fix Key
          </button>
        ) : null}
        {errorDetails?.isQuotaError && (
          <button
            onClick={onTryLite}
            className="px-2 py-0.5 rounded bg-amber-800 hover:bg-amber-700 text-amber-100 font-medium flex items-center gap-1 text-[11px]"
          >
            <RefreshCw className="w-3 h-3" /> Try Lite
          </button>
        )}
        {errorDetails?.isUnavailable && (
          <button
            onClick={onRetry}
            className="px-2 py-0.5 rounded bg-amber-800 hover:bg-amber-700 text-amber-100 font-medium flex items-center gap-1 text-[11px]"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        )}
        <button
          onClick={onClearError}
          className="p-1 text-zinc-400 hover:text-white rounded transition"
          title="Dismiss error"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
