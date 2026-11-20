import React, { useSyncExternalStore } from "react";
import { RefreshCw, X } from "lucide-react";
import { pwaUpdateManager } from "../utils/pwaUpdate";

export const PWAUpdateBanner: React.FC<{ isGenerating?: boolean }> = ({ isGenerating = false }) => {
  const state = useSyncExternalStore(pwaUpdateManager.subscribe, pwaUpdateManager.getSnapshot);

  if (!state.needRefresh) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-3 mt-2 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-foreground shadow-sm"
    >
      <div className="flex items-center gap-2 min-w-0">
        <RefreshCw className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="truncate">
          {isGenerating
            ? "A new version is ready. Finish streaming, then refresh."
            : "A new version of Helm is ready."}
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => void pwaUpdateManager.applyUpdate()}
          disabled={isGenerating}
          className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          Refresh
        </button>
        <button
          type="button"
          onClick={() => pwaUpdateManager.dismissRefresh()}
          aria-label="Dismiss update notification"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
