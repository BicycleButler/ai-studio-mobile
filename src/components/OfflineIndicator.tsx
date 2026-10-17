import React from "react";
import { WifiOff, Loader2, Check } from "lucide-react";
import { ConflictResolutionModal } from "./ConflictResolutionModal";
import { useOfflineSync } from "../hooks/useOfflineSync";

export const OfflineIndicator: React.FC = () => {
  const {
    isOnline,
    reconnectState,
    pendingQueueLength,
    conflictData,
    handleResolveConflict
  } = useOfflineSync();

  if (!isOnline) {
    return (
      <div
        id="pwa-offline-indicator"
        role="status"
        aria-live="polite"
        className="sticky top-0 z-[100] w-full flex items-center justify-between px-4 py-2 bg-muted text-foreground border-b border-border/60 text-xs font-medium animate-in slide-in-from-top-full duration-200"
      >
        <div className="flex items-center gap-2">
          <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
          <span>You are offline. {pendingQueueLength > 0 ? `${pendingQueueLength} changes queued.` : 'Working in read/cache mode.'}</span>
        </div>
      </div>
    );
  }

  if (reconnectState === "reconnecting") {
    return (
      <div
        id="pwa-reconnected-indicator"
        role="status"
        aria-live="polite"
        className="sticky top-0 z-[100] w-full flex items-center justify-between px-4 py-2 bg-muted text-foreground border-b border-border/60 text-xs font-medium animate-in slide-in-from-top-full duration-200"
      >
        <div className="flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
          <span>Reconnecting & syncing changes...</span>
        </div>
      </div>
    );
  }

  if (reconnectState === "success") {
    return (
      <div
        id="pwa-reconnected-indicator-success"
        role="status"
        aria-live="polite"
        className="sticky top-0 z-[100] w-full flex items-center justify-between px-4 py-2 bg-muted text-foreground border-b border-border/60 text-xs font-medium animate-in slide-in-from-top-full duration-200"
      >
        <div className="flex items-center gap-2">
          <Check className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Sync complete</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <ConflictResolutionModal
        isOpen={reconnectState === "conflict" && conflictData !== null}
        onCancel={() => handleResolveConflict('keep')}
        onKeepRemote={() => handleResolveConflict('keep')}
        onOverwriteRemote={() => handleResolveConflict('overwrite')}
        localData={(conflictData?.localData as Record<string, unknown>) || {}}
        remoteData={(conflictData?.remoteData as Record<string, unknown>) || {}}
      />
    </>
  );
};
