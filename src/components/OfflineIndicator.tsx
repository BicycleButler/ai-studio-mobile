import React, { useState, useEffect } from "react";
import { WifiOff, Loader2, Check } from "lucide-react";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import {
  processOfflineMutations,
  ConflictData,
  removeOfflineMutation,
  enqueueOfflineMutation,
  getOfflineQueueLength
} from "../utils/offlineService";
import { ConflictResolutionModal } from "./ConflictResolutionModal";

export const OfflineIndicator: React.FC = () => {
  const { isOnline, wasOffline } = useNetworkStatus();
  const [reconnectState, setReconnectState] = useState<"idle" | "reconnecting" | "success" | "conflict">("idle");
  const [pendingQueueLength, setPendingQueueLength] = useState(0);
  const [conflictData, setConflictData] = useState<ConflictData | null>(null);

  useEffect(() => {
    // Check pending queue length
    const checkQueue = async () => {
      const length = await getOfflineQueueLength();
      setPendingQueueLength(length);
    };
    checkQueue();
  }, [isOnline]);

  useEffect(() => {
    if (isOnline && wasOffline) {
      setReconnectState("reconnecting");

      const processQueue = async () => {
        const { conflicts } = await processOfflineMutations();
        if (conflicts.length > 0) {
           setConflictData(conflicts[0]); // Handle first conflict for simplicity
           setReconnectState("conflict");
        } else {
           setReconnectState("success");
           setTimeout(() => setReconnectState("idle"), 3000);
        }
      };

      processQueue();
    }
  }, [isOnline, wasOffline]);

  const handleResolveConflict = async (action: 'keep' | 'overwrite') => {
     if (conflictData) {
       await removeOfflineMutation(conflictData.id);
       if (action === 'overwrite') {
          // Re-enqueue without version check to force overwrite (or a special flag if backend supports it).
          // For now, we simulate overwrite by re-enqueueing the local payload.
          await enqueueOfflineMutation(conflictData.type, conflictData.localData, undefined);
          const { conflicts } = await processOfflineMutations();
          if (conflicts.length > 0) {
             setConflictData(conflicts[0]);
             return;
          }
       }
     }

     setConflictData(null);

     const queueLength = await getOfflineQueueLength();
     if (queueLength > 0) {
        // More conflicts or remaining items
        const { conflicts } = await processOfflineMutations();
        if (conflicts.length > 0) {
           setConflictData(conflicts[0]);
           setReconnectState("conflict");
        } else {
           setReconnectState("success");
           setTimeout(() => setReconnectState("idle"), 3000);
        }
     } else {
        setReconnectState("success");
        setTimeout(() => setReconnectState("idle"), 3000);
     }
  };

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
