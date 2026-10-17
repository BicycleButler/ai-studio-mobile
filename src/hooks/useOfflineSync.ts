import { useState, useEffect, useCallback } from "react";
import { useNetworkStatus } from "./useNetworkStatus";
import {
  processOfflineMutations,
  ConflictData,
  removeOfflineMutation,
  enqueueOfflineMutation,
  getOfflineQueueLength
} from "../utils/offlineService";

export type ReconnectState = "idle" | "reconnecting" | "success" | "conflict";

export function useOfflineSync() {
  const { isOnline, wasOffline } = useNetworkStatus();
  const [reconnectState, setReconnectState] = useState<ReconnectState>("idle");
  const [pendingQueueLength, setPendingQueueLength] = useState(0);
  const [conflictData, setConflictData] = useState<ConflictData | null>(null);

  useEffect(() => {
    let mounted = true;
    const checkQueue = async () => {
      const length = await getOfflineQueueLength();
      if (mounted) setPendingQueueLength(length);
    };
    checkQueue();
    return () => { mounted = false; };
  }, [isOnline]);

  useEffect(() => {
    let mounted = true;
    if (isOnline && wasOffline) {
      setReconnectState("reconnecting");

      const processQueue = async () => {
        const { conflicts } = await processOfflineMutations();
        if (!mounted) return;
        if (conflicts.length > 0) {
           setConflictData(conflicts[0]);
           setReconnectState("conflict");
        } else {
           setReconnectState("success");
           setTimeout(() => {
             if (mounted) setReconnectState("idle");
           }, 3000);
        }
      };

      processQueue();
    }
    return () => { mounted = false; };
  }, [isOnline, wasOffline]);

  const handleResolveConflict = useCallback(async (action: 'keep' | 'overwrite') => {
     if (conflictData) {
       await removeOfflineMutation(conflictData.id);
       if (action === 'overwrite') {
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
  }, [conflictData]);

  return {
    isOnline,
    reconnectState,
    pendingQueueLength,
    conflictData,
    handleResolveConflict
  };
}
