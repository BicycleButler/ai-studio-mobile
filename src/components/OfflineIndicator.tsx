import React from "react";
import { WifiOff, Loader2, Check, AlertTriangle, X } from "lucide-react";
import { ConflictResolutionModal } from "./ConflictResolutionModal";
import { useOfflineSync } from "../hooks/useOfflineSync";
import { useServices } from "../services/ServiceContext";

export const OfflineIndicator: React.FC = () => {
  const { platformService } = useServices();
  const {
    isOnline,
    reconnectState,
    pendingQueueLength,
    conflictData,
    syncWarning,
    deadLetterCount,
    retryDeadLetters,
    dismissSyncWarning,
    handleResolveConflict
  } = useOfflineSync();

  const warningBanner = syncWarning ? (
    <div
      id="pwa-sync-warning-indicator"
      role="alert"
      className="sticky top-0 z-[100] w-full flex items-center justify-between gap-2 px-4 py-2 bg-destructive/10 text-destructive border-b border-destructive/30 text-xs font-medium"
    >
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{syncWarning}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {deadLetterCount > 0 && (
          <button
            type="button"
            onClick={() => void retryDeadLetters()}
            className="px-2 py-0.5 rounded bg-destructive/15 hover:bg-destructive/25 text-destructive font-semibold transition-colors"
          >
            Retry ({deadLetterCount})
          </button>
        )}
        <button
          type="button"
          onClick={dismissSyncWarning}
          aria-label="Dismiss sync warning"
          className="p-1 -mr-1 rounded hover:bg-destructive/15"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  ) : null;

  if (!isOnline) {
    return (
      <>
        {warningBanner}
        <div
          id="pwa-offline-indicator"
          role="status"
          aria-live="polite"
          className="sticky top-0 z-[100] w-full flex items-center justify-between px-4 py-2 bg-muted text-foreground border-b border-border/60 text-xs font-medium animate-in slide-in-from-top-full duration-200"
        >
          <div className="flex items-center gap-2">
            <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
            <span>You are offline. {pendingQueueLength > 0 ? `${pendingQueueLength} changes queued. ` : ''}Working in read/cache mode.</span>
          </div>
          <button
            onClick={() => platformService.reloadWindow()}
            className="text-primary hover:text-primary/80 font-semibold px-2 py-1 -mr-2"
          >
            [Retry]
          </button>
        </div>
      </>
    );
  }

  if (reconnectState === "reconnecting") {
    return (
      <>
        {warningBanner}
        <div
          id="pwa-reconnected-indicator"
          role="status"
          aria-live="polite"
          className="sticky top-0 z-[100] w-full flex items-center justify-between px-4 py-2 bg-muted text-foreground border-b border-border/60 text-xs font-medium animate-in slide-in-from-top-full duration-200"
        >
          <div className="flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
            <span>{pendingQueueLength > 0 ? `Reconnecting & syncing ${pendingQueueLength} changes...` : 'Reconnecting...'}</span>
          </div>
        </div>
      </>
    );
  }

  if (reconnectState === "success") {
    return (
      <>
        {warningBanner}
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
      </>
    );
  }

  return (
    <>
      {warningBanner}
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
