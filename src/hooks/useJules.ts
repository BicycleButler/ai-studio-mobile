import { useServices } from "../services/ServiceContext";
import { useStore } from "./useStore";
import { getErrorMessage } from "../utils/errorHandling";
import { useState, useRef, useCallback, useEffect } from "react";
import { ChatMessage, JulesSession, MessageAttachment } from "../types";
import { JulesTaskPayload } from "../services/julesService";


export function useJules() {
  const { julesStorageService, julesClient, logger, timeProvider } = useServices();
  const julesSessionsManager = julesStorageService.julesSessionsManager;
  const [julesApiKey, setJulesApiKey] = useState<string>(() => julesStorageService.loadStoredJulesApiKey());

  const julesStore = useStore(julesSessionsManager);
  const julesSessions = julesStore.items;
  const activeJulesSession = julesStore.activeItem;

  const [isJulesExecuting, setIsJulesExecuting] = useState(false);
  const [isApprovingJulesPlan, setIsApprovingJulesPlan] = useState(false);

  const julesMessages = activeJulesSession?.messages || [];

  const julesPollingRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    julesStorageService.fetchJulesSessionsFromServer();
  }, []);

  const handleSaveJulesApiKey = useCallback((key: string) => {
    setJulesApiKey(key);
    julesStorageService.saveStoredJulesApiKey(key);
  }, []);

  const handleStopJulesPolling = useCallback(() => {
    if (julesPollingRef.current) {
      julesPollingRef.current.stop();
      julesPollingRef.current = null;
    }
    setIsJulesExecuting(false);
  }, []);

  const handleClearJulesMessages = useCallback(() => {
    handleStopJulesPolling();
    if (activeJulesSession) {
      const updated = { ...activeJulesSession, messages: [], updatedAt: timeProvider.now() };
      julesSessionsManager.collection.upsert(updated);
    }
  }, [activeJulesSession, handleStopJulesPolling]);

  const handleSendJulesMessage = useCallback(
    async (
      text: string,
      _attachments: MessageAttachment[] = [],
      templateIds: string[] = [],
      rawUserText?: string
    ) => {
      let currentSession = activeJulesSession;
      if (!currentSession) {
        return false; // Indicating that a session needs to be created/selected via UI
      }

      if (!julesApiKey.trim()) {
        const errorMsg: ChatMessage = {
          id: `msg_${timeProvider.now()}_err`,
          role: "model",
          text: "Jules API Key is required to authorize autonomous workspace access. Please configure it in settings.",
          timestamp: timeProvider.now(),
          error: "Missing API Key",
        };
        const sessionWithMessages: JulesSession = {
          ...currentSession,
          messages: [...(currentSession.messages || []), errorMsg],
          updatedAt: timeProvider.now(),
        };
        julesSessionsManager.collection.upsert(sessionWithMessages);
        return true;
      }

      const userMsg: ChatMessage = {
        id: `msg_${timeProvider.now()}`,
        role: "user",
        text,
        rawUserText,
        templateIds,
        timestamp: timeProvider.now(),
        julesActivity: {
          type: "plan",
          status: "queued",
          title: `Dispatching task to Jules for ${currentSession.repository}...`,
        },
      };

      const aiMsg: ChatMessage = {
        id: `msg_${timeProvider.now() + 1}`,
        role: "model",
        text: "",
        timestamp: timeProvider.now() + 1,
        isStreaming: true,
        julesActivity: {
          type: "plan",
          status: "analyzing",
          planDescription: `Jules is inspecting ${currentSession.repository} (branch: ${currentSession.branch}) and planning autonomous changes.`,
        },
      };

      const updatedMessages = [...(currentSession.messages || []), userMsg, aiMsg];

      const sessionWithMessages: JulesSession = {
        ...currentSession,
        status: "analyzing",
        messages: updatedMessages,
        updatedAt: timeProvider.now(),
      };

      julesSessionsManager.collection.upsert(sessionWithMessages);

      setIsJulesExecuting(true);

      try {
        const dispatchedTask = await julesClient.dispatchTask({
          repository: currentSession.repository,
          branch: currentSession.branch,
          prompt: text,
          autoApprove: currentSession.autoApprovePlan,
        });

        const activeAiMsgId = aiMsg.id;

        // Re-fetch current session to avoid stale closure
        currentSession = julesSessionsManager.getActiveItem()!;
        if (currentSession) {
          const planningMessages = (currentSession.messages || []).map(m =>
            m.id === activeAiMsgId
              ? {
                  ...m,
                  julesActivity: {
                    ...m.julesActivity!,
                    taskId: dispatchedTask.id,
                    status: "planning" as const,
                    title: `Jules task created: #${dispatchedTask.id.slice(0, 8)}`,
                  },
                }
              : m
          );

          julesSessionsManager.collection.upsert({
            ...currentSession,
            messages: planningMessages,
            updatedAt: timeProvider.now()
          });
        }

        julesPollingRef.current = julesClient.subscribeToTask(
          dispatchedTask.id,
          (taskUpdate: JulesTaskPayload) => {
            const latestSession = julesSessionsManager.getActiveItem();
            if (latestSession && latestSession.id === currentSession?.id) {
               const polledMessages = (latestSession.messages || []).map(m => {
                  if (m.id === activeAiMsgId && m.julesActivity) {
                    const isCompleted =
                      taskUpdate.status === "completed" || taskUpdate.status === "failed";
                    return {
                      ...m,
                      isStreaming: !isCompleted,
                      text:
                        taskUpdate.status === "failed"
                          ? `Jules encountered an error while executing task.`
                          : m.text,
                      error: taskUpdate.error || taskUpdate.errorMessage,
                      julesActivity: {
                        ...m.julesActivity,
                        status: taskUpdate.status,
                        planDescription: taskUpdate.planDescription || m.julesActivity.planDescription,
                        steps: taskUpdate.steps || m.julesActivity.steps,
                        pullRequestUrl: taskUpdate.pullRequestUrl,
                        pullRequestNumber: taskUpdate.pullRequestNumber,
                        requiresApproval: taskUpdate.requiresApproval,
                        diffStats: taskUpdate.diffStats || m.julesActivity.diffStats,
                      },
                    };
                  }
                  return m;
               });

               julesSessionsManager.collection.upsert({
                 ...latestSession,
                 status: taskUpdate.status,
                 messages: polledMessages,
                 updatedAt: timeProvider.now(),
               });
            }

            if (taskUpdate.status === "completed" || taskUpdate.status === "failed") {
              setIsJulesExecuting(false);
            }
          },
          (error) => {
            logger.error("Jules polling error:", error);
            setIsJulesExecuting(false);
          }
        );
      } catch (err: unknown) {
        setIsJulesExecuting(false);
        const errMsg = getErrorMessage(err) || "Failed to dispatch Jules task";
        const errorSession = julesSessionsManager.getActiveItem();
        if (errorSession) {
          const errorMessages = (errorSession.messages || []).map(m =>
             m.id === aiMsg.id
              ? {
                  ...m,
                  isStreaming: false,
                  error: errMsg,
                  julesActivity: { ...m.julesActivity!, status: "failed" as const },
                }
              : m
          );
          julesSessionsManager.collection.upsert({
             ...errorSession,
             messages: errorMessages,
             updatedAt: timeProvider.now()
          });
        }
      }
      return true;
    },
    [activeJulesSession]
  );

  const handleApproveJulesPlan = useCallback(
    async (taskId: string) => {
      setIsApprovingJulesPlan(true);
      try {
        await julesClient.approvePlan(taskId, true);
        const latestSession = julesSessionsManager.getActiveItem();
        if (latestSession) {
           const approvedMessages = (latestSession.messages || []).map(m =>
             m.julesActivity?.taskId === taskId
                ? {
                    ...m,
                    julesActivity: {
                      ...m.julesActivity,
                      status: "executing" as const,
                      title: "Plan approved. Jules is executing changes and committing...",
                      requiresApproval: false,
                    },
                  }
                : m
           );
           julesSessionsManager.collection.upsert({
             ...latestSession,
             messages: approvedMessages,
             updatedAt: timeProvider.now()
           });
        }
      } catch (err: unknown) {
        const errMsg = getErrorMessage(err) || "Failed to approve plan";
        const latestSession = julesSessionsManager.getActiveItem();
        if (latestSession) {
           const errorMessages = (latestSession.messages || []).map(m =>
             m.julesActivity?.taskId === taskId
                ? { ...m, error: errMsg }
                : m
           );
           julesSessionsManager.collection.upsert({
             ...latestSession,
             messages: errorMessages,
             updatedAt: timeProvider.now()
           });
        }
      } finally {
        setIsApprovingJulesPlan(false);
      }
    },
    []
  );

  const handleRejectJulesPlan = useCallback(
    async (taskId: string) => {
      try {
        await julesClient.approvePlan(taskId, false);
        const latestSession = julesSessionsManager.getActiveItem();
        if (latestSession) {
           const rejectedMessages = (latestSession.messages || []).map(m =>
             m.julesActivity?.taskId === taskId
                ? {
                    ...m,
                    isStreaming: false,
                    julesActivity: {
                      ...m.julesActivity,
                      status: "failed" as const,
                      title: "Plan rejected. Task aborted.",
                      requiresApproval: false,
                    },
                  }
                : m
           );
           julesSessionsManager.collection.upsert({
             ...latestSession,
             messages: rejectedMessages,
             updatedAt: timeProvider.now()
           });
        }
      } catch (err: unknown) {
        logger.error("Failed to reject plan:", err);
      }
    },
    []
  );

  const handleSelectSession = useCallback((sess: Partial<JulesSession>) => {
    if (sess.id) {
       julesSessionsManager.setActiveId(sess.id);
    }
  }, []);

  const handleBulkDeleteJulesSessions = useCallback((sessionIds: string[]) => {
    if (!sessionIds || sessionIds.length === 0) return;

    julesStorageService.bulkDeleteJulesSessions(sessionIds);

    if (activeJulesSession && sessionIds.includes(activeJulesSession.id)) {
      julesSessionsManager.setActiveId(null);
    }
  }, [activeJulesSession]);

  return {
    julesApiKey,
    handleSaveJulesApiKey,
    julesSessions,
    activeJulesSession,
    julesMessages,
    isJulesExecuting,
    isApprovingJulesPlan,
    handleSendJulesMessage,
    handleClearJulesMessages,
    handleStopJulesPolling,
    handleApproveJulesPlan,
    handleRejectJulesPlan,
    handleSelectSession,
    handleBulkDeleteJulesSessions
  };
}
