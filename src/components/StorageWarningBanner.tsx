import React, { useSyncExternalStore } from "react";
import { AlertTriangle, X } from "lucide-react";
import { storageDegradationTracker } from "../utils/storage/degradationState";

export const StorageWarningBanner: React.FC = () => {
  const state = useSyncExternalStore(
    storageDegradationTracker.subscribe,
    storageDegradationTracker.getSnapshot
  );

  if (!state.isDegraded || state.dismissed) {
    return null;
  }

  return (
    <div
      role="alert"
      className="mx-3 mt-2 flex items-center justify-between gap-2.5 rounded-xl border border-border bg-muted/60 px-3 py-2 text-xs text-foreground shadow-xs"
    >
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">
          {state.reason || "Browser storage is full or restricted. New changes are stored temporarily in memory."}
        </span>
      </div>
      <button
        type="button"
        onClick={() => storageDegradationTracker.dismiss()}
        aria-label="Dismiss storage warning"
        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
