import { useState, useEffect, useCallback, useRef } from "react";
import { useNetworkStatus } from "./useNetworkStatus";
import {
  IOfflineService,
  ConflictData
} from "../utils/offlineService";
import { useServices } from "../services/ServiceContext";
import { useOfflineQueue } from "./useOfflineQueue";
import { syncConflictBus } from "../utils/syncConflictBus";
import { syncVersionTracker } from "../utils/syncVersionTracker";
import { errorReporter } from "../utils/errorReporter";
import { ProjectInfo, SavedPrompt } from "../types";

export type ReconnectState = "idle" | "reconnecting" | "success" | "conflict";

export function useOfflineSync(customOfflineService?: IOfflineService) {
  const {
    offlineService: contextOfflineService,
    platformService,
    projectService,
    savedPromptsService,
  } = useServices();
  const offlineService = customOfflineService || contextOfflineService;
  const { isOnline, wasOffline } = useNetworkStatus();
  const queue = useOfflineQueue(offlineService);
  const pendingQueueLength = queue.length;

  const [reconnectState, setReconnectState] = useState<ReconnectState>("idle");
  const [conflictData, setConflictData] = useState<ConflictData | null>(null);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [deadLetterCount, setDeadLetterCount] = useState<number>(0);

  const mountedRef = useRef(true);
  const successTimerRef = useRef<unknown>(null);
  const retryTimerRef = useRef<unknown>(null);
  const isDrainingRef = useRef(false);
  const startupDrainDoneRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (successTimerRef.current !== null) {
        platformService.clearTimeout(successTimerRef.current);
        successTimerRef.current = null;
      }
      if (retryTimerRef.current !== null) {
        platformService.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [platformService]);

  const refreshDeadLetterCount = useCallback(async () => {
    if (typeof offlineService.getDeadLetterQueue !== "function") return;
    try {
      const items = await offlineService.getDeadLetterQueue();
      if (mountedRef.current) {
        setDeadLetterCount(items.length);
      }
    } catch {
      // ignore
    }
  }, [offlineService]);

  useEffect(() => {
    void refreshDeadLetterCount();
  }, [refreshDeadLetterCount]);

  const handleProcessResult = useCallback((conflicts: ConflictData[], droppedIds?: string[]) => {
    if (!mountedRef.current) return;
    if (droppedIds && droppedIds.length > 0) {
      const msg = `${droppedIds.length} queued change${droppedIds.length === 1 ? "" : "s"} could not be synced after multiple attempts and moved to recovery.`;
      setSyncWarning(msg);
      errorReporter.report("sync_dropped", msg, {
        scope: "offline_sync",
        metadata: { droppedCount: droppedIds.length },
      });
      void refreshDeadLetterCount();
    }
    if (conflicts.length > 0) {
      setConflictData(conflicts[0]);
      setReconnectState("conflict");
    } else {
      setReconnectState("success");
      if (successTimerRef.current !== null) {
        platformService.clearTimeout(successTimerRef.current);
      }
      successTimerRef.current = platformService.setTimeout(() => {
        successTimerRef.current = null;
        if (mountedRef.current) {
          setReconnectState((prev) => (prev === "success" ? "idle" : prev));
        }
      }, 3000);
    }
  }, [platformService, refreshDeadLetterCount]);

  const drainQueue = useCallback(async () => {
    if (isDrainingRef.current) return;
    isDrainingRef.current = true;
    if (mountedRef.current) {
      setReconnectState((prev) => (prev === "conflict" ? prev : "reconnecting"));
    }
    try {
      const { conflicts, droppedIds } = await offlineService.processOfflineMutations();
      if (mountedRef.current) {
        handleProcessResult(conflicts, droppedIds);
      }
    } finally {
      isDrainingRef.current = false;
    }
  }, [offlineService, handleProcessResult]);

  // Listen for direct online 409 conflicts emitted by NetworkStorageSyncAdapter
  useEffect(() => {
    return syncConflictBus.subscribe((conflict) => {
      if (!mountedRef.current) return;
      setConflictData(conflict);
      setReconnectState("conflict");
    });
  }, []);

  // Trigger queue processing both on reconnect AND once when a persisted queue hydrates while online
  useEffect(() => {
    if (!isOnline) {
      return;
    }

    if (wasOffline) {
      void drainQueue();
      return;
    }

    if (pendingQueueLength > 0 && !startupDrainDoneRef.current) {
      startupDrainDoneRef.current = true;
      void drainQueue();
    }
  }, [isOnline, wasOffline, pendingQueueLength, drainQueue]);

  // If items remain queued with a future nextRetryAt while online, schedule a single wakeup timer
  useEffect(() => {
    if (retryTimerRef.current !== null) {
      platformService.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (!isOnline || queue.length === 0) return;
    const nextRetryAt = queue.reduce<number | null>((min, m) => {
      if (typeof m.nextRetryAt !== "number") return min;
      return min === null ? m.nextRetryAt : Math.min(min, m.nextRetryAt);
    }, null);
    if (nextRetryAt === null) return;
    const delayMs = Math.max(500, nextRetryAt - Date.now());
    retryTimerRef.current = platformService.setTimeout(() => {
      retryTimerRef.current = null;
      if (mountedRef.current) {
        void drainQueue();
      }
    }, delayMs);
    return () => {
      if (retryTimerRef.current !== null) {
        platformService.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [isOnline, queue, platformService, drainQueue]);

  const handleResolveConflict = useCallback(async (action: 'keep' | 'overwrite') => {
    if (conflictData) {
      await offlineService.removeOfflineMutation(conflictData.id);
      if (action === 'keep') {
        const resourceKind =
          conflictData.type === "projects"
            ? "projects"
            : conflictData.type === "saved_prompts"
              ? "prompts"
              : null;
        if (resourceKind && typeof conflictData.remoteVersion === "number") {
          syncVersionTracker.setVersion(resourceKind, conflictData.remoteVersion);
        }
        if (Array.isArray(conflictData.remoteData)) {
          if (conflictData.type === "projects" && projectService?.projectsManager?.collection) {
            const localProjects = projectService.loadStoredProjects();
            const keyById = new Map(localProjects.map((p) => [p.id, p.apiKey]));
            const merged = (conflictData.remoteData as ProjectInfo[]).map((remoteProj) => ({
              ...remoteProj,
              apiKey: remoteProj.apiKey || keyById.get(remoteProj.id) || "",
            }));
            projectService.projectsManager.collection.save(merged, { skipSync: true });
          } else if (conflictData.type === "saved_prompts" && savedPromptsService?.savedPromptsManager?.collection) {
            savedPromptsService.savedPromptsManager.collection.save(
              conflictData.remoteData as SavedPrompt[],
              { skipSync: true }
            );
          }
        }
      } else if (action === 'overwrite') {
        await offlineService.enqueueOfflineMutation(conflictData.type, conflictData.localData, -1);
        const { conflicts, droppedIds } = await offlineService.processOfflineMutations();
        if (!mountedRef.current) return;
        if (conflicts.length > 0) {
          setConflictData(conflicts[0]);
          return;
        }
        handleProcessResult([], droppedIds);
      }
    }

    if (!mountedRef.current) return;
    setConflictData(null);

    const queueLength = await offlineService.getOfflineQueueLength();
    if (!mountedRef.current) return;
    if (queueLength > 0) {
      const { conflicts, droppedIds } = await offlineService.processOfflineMutations();
      handleProcessResult(conflicts, droppedIds);
    } else if (action !== 'overwrite') {
      handleProcessResult([]);
    }
  }, [conflictData, offlineService, handleProcessResult, projectService, savedPromptsService]);

  const retryDeadLetters = useCallback(async () => {
    if (typeof offlineService.retryDeadLetterQueue !== "function") return;
    const requeued = await offlineService.retryDeadLetterQueue();
    if (mountedRef.current) {
      setDeadLetterCount(0);
      setSyncWarning(null);
    }
    if (requeued > 0 && isOnline) {
      await drainQueue();
    }
  }, [offlineService, isOnline, drainQueue]);

  const clearDeadLetters = useCallback(async () => {
    if (typeof offlineService.clearDeadLetterQueue === "function") {
      await offlineService.clearDeadLetterQueue();
    }
    if (mountedRef.current) {
      setDeadLetterCount(0);
      setSyncWarning(null);
    }
  }, [offlineService]);

  const dismissSyncWarning = useCallback(() => {
    setSyncWarning(null);
  }, []);

  return {
    isOnline,
    reconnectState,
    pendingQueueLength,
    conflictData,
    syncWarning,
    deadLetterCount,
    retryDeadLetters,
    clearDeadLetters,
    dismissSyncWarning,
    handleResolveConflict
  };
}
