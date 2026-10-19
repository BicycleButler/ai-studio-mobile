import { getErrorMessage } from "../utils/errorHandling";
import { useState, useRef, useCallback, useEffect } from "react";
import { ChatMessage, JulesSession, MessageAttachment } from "../types";
import { JulesTaskPayload } from "../services/julesService";
import {
  loadStoredJulesApiKey,
  saveStoredJulesApiKey,
  fetchJulesSessionsFromServer,
  getActiveJulesSession,
  setActiveJulesSessionId,
  updateStoredJulesSession,
} from "../utils/storage";
import {
  useStorage,
  julesSessionsManager
} from "../utils/storage";
import {
  dispatchJulesTask,
  subscribeToJulesTask,
  approveJulesPlan,
  bulkDeleteJulesSessions
} from "../services/julesService";

export function useJules() {
  const [julesApiKey, setJulesApiKey] = useState<string>(() => loadStoredJulesApiKey());
  const julesStore = useStorage(julesSessionsManager);
  const julesSessions = julesStore.items;
  const setJulesSessions: React.Dispatch<React.SetStateAction<JulesSession[]>> = (val) => {
    if (typeof val === "function") {
      julesSessionsManager.saveItems(val(julesSessions));
    } else {
      julesSessionsManager.saveItems(val);
    }
  };
  const activeJulesSession = julesStore.activeItem;
  const setActiveJulesSession: React.Dispatch<React.SetStateAction<JulesSession | null>> = (val) => {
    if (typeof val === "function") {
      const result = val(activeJulesSession);
      julesSessionsManager.setActiveId(result ? result.id : null);
    } else {
      julesSessionsManager.setActiveId(val ? val.id : null);
    }
  };
  const [isJulesExecuting, setIsJulesExecuting] = useState(false);
  const [isApprovingJulesPlan, setIsApprovingJulesPlan] = useState(false);
  const [julesMessages, setJulesMessages] = useState<ChatMessage[]>(() => getActiveJulesSession()?.messages || []);

  const julesPollingRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    fetchJulesSessionsFromServer().then(() => {

      const activeSession = getActiveJulesSession();
      setActiveJulesSession(activeSession);
      if (activeSession) {
        setJulesMessages(activeSession.messages || []);
      }
    });
  }, []);

  const handleSaveJulesApiKey = useCallback((key: string) => {
    setJulesApiKey(key);
    saveStoredJulesApiKey(key);
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
    setJulesMessages([]);
    if (activeJulesSession) {
      const updated = { ...activeJulesSession, messages: [], updatedAt: Date.now() };
      updateStoredJulesSession(updated);
      setActiveJulesSession(updated);
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
          id: `msg_${Date.now()}_err`,
          role: "model",
          text: "Jules API Key is required to authorize autonomous workspace access. Please configure it in settings.",
          timestamp: Date.now(),
          error: "Missing API Key",
        };
        setJulesMessages((prev) => [...prev, errorMsg]);
        return true;
      }

      const userMsg: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: "user",
        text,
        rawUserText,
        templateIds,
        timestamp: Date.now(),
        julesActivity: {
          type: "plan",
          status: "queued",
          title: `Dispatching task to Jules for ${currentSession.repository}...`,
        },
      };

      const aiMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: "model",
        text: "",
        timestamp: Date.now() + 1,
        isStreaming: true,
        julesActivity: {
          type: "plan",
          status: "analyzing",
          planDescription: `Jules is inspecting ${currentSession.repository} (branch: ${currentSession.branch}) and planning autonomous changes.`,
        },
      };

      const updatedMessages = [...julesMessages, userMsg, aiMsg];
      setJulesMessages(updatedMessages);

      const sessionWithMessages: JulesSession = {
        ...currentSession,
        status: "analyzing",
        messages: updatedMessages,
        updatedAt: Date.now(),
      };
      updateStoredJulesSession(sessionWithMessages);
      setActiveJulesSession(sessionWithMessages);
      setJulesSessions((prev) =>
        prev.map((s) => (s.id === sessionWithMessages.id ? sessionWithMessages : s))
      );

      setIsJulesExecuting(true);

      try {
        const dispatchedTask = await dispatchJulesTask(julesApiKey, {
          repository: currentSession.repository,
          branch: currentSession.branch,
          prompt: text,
          autoApprove: currentSession.autoApprovePlan,
        });

        const activeAiMsgId = aiMsg.id;

        setJulesMessages((prev) =>
          prev.map((m) =>
            m.id === activeAiMsgId
              ? {
                  ...m,
                  julesActivity: {
                    ...m.julesActivity!,
                    taskId: dispatchedTask.id,
                    status: "planning",
                    title: `Jules task created: #${dispatchedTask.id.slice(0, 8)}`,
                  },
                }
              : m
          )
        );



        julesPollingRef.current = subscribeToJulesTask(
          julesApiKey,
          dispatchedTask.id,
          (taskUpdate: JulesTaskPayload) => {
            setJulesMessages((prev) => {
              return prev.map((m) => {
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
            });

            if (currentSession) {
              setActiveJulesSession((prevSession) => {
                if (prevSession && prevSession.id === currentSession.id) {
                  return {
                    ...prevSession,
                    status: taskUpdate.status,
                    updatedAt: Date.now(),
                  };
                }
                return prevSession;
              });
            }

            if (taskUpdate.status === "completed" || taskUpdate.status === "failed") {
              setIsJulesExecuting(false);
            }
          },
          (error) => {
            console.error("Jules polling error:", error);
            setIsJulesExecuting(false);
          }
        );
      } catch (err: unknown) {
        setIsJulesExecuting(false);
        const errMsg = getErrorMessage(err) || "Failed to dispatch Jules task";
        setJulesMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsg.id
              ? {
                  ...m,
                  isStreaming: false,
                  error: errMsg,
                  julesActivity: { ...m.julesActivity!, status: "failed" },
                }
              : m
          )
        );
      }
      return true;
    },
    [activeJulesSession, julesApiKey, julesMessages]
  );

  const handleApproveJulesPlan = useCallback(
    async (taskId: string) => {
      setIsApprovingJulesPlan(true);
      try {
        await approveJulesPlan(taskId, true, julesApiKey);
        setJulesMessages((prev) =>
          prev.map((m) =>
            m.julesActivity?.taskId === taskId
              ? {
                  ...m,
                  julesActivity: {
                    ...m.julesActivity,
                    status: "executing",
                    title: "Plan approved. Jules is executing changes and committing...",
                    requiresApproval: false,
                  },
                }
              : m
          )
        );
      } catch (err: unknown) {
        const errMsg = getErrorMessage(err) || "Failed to approve plan";
        setJulesMessages((prev) =>
          prev.map((m) =>
            m.julesActivity?.taskId === taskId
              ? { ...m, error: errMsg }
              : m
          )
        );
      } finally {
        setIsApprovingJulesPlan(false);
      }
    },
    [julesApiKey]
  );

  const handleRejectJulesPlan = useCallback(
    async (taskId: string) => {
      try {
        await approveJulesPlan(taskId, false, julesApiKey);
        setJulesMessages((prev) =>
          prev.map((m) =>
            m.julesActivity?.taskId === taskId
              ? {
                  ...m,
                  isStreaming: false,
                  julesActivity: {
                    ...m.julesActivity,
                    status: "failed",
                    title: "Plan rejected. Task aborted.",
                    requiresApproval: false,
                  },
                }
              : m
          )
        );
      } catch (err: unknown) {
        console.error("Failed to reject plan:", err);
      }
    },
    [julesApiKey]
  );

  const handleSelectSession = useCallback((sess: Partial<JulesSession>) => {
    const jSession = julesSessions.find((s) => s.id === sess.id);
    if (jSession) {
      setActiveJulesSessionId(jSession.id);
      setActiveJulesSession(jSession);
      setJulesMessages(jSession.messages || []);
    }
  }, [julesSessions]);

  const handleBulkDeleteJulesSessions = useCallback((sessionIds: string[]) => {
    if (!sessionIds || sessionIds.length === 0) return;

    bulkDeleteJulesSessions(sessionIds);



    if (activeJulesSession && sessionIds.includes(activeJulesSession.id)) {

      setJulesMessages([]);
      setActiveJulesSessionId(null);
    }
  }, [activeJulesSession]);

  // Sync julesMessages and activeJulesSession to storage
  useEffect(() => {
    if (activeJulesSession) {
      const hasMessagesChanged = activeJulesSession.messages !== julesMessages;
      if (hasMessagesChanged) {
        const updatedSess = { ...activeJulesSession, messages: julesMessages, updatedAt: Date.now() };
        updateStoredJulesSession(updatedSess);

        setActiveJulesSession(updatedSess);

        setJulesSessions((prevSessions) =>
          prevSessions.map((s) => (s.id === updatedSess.id ? updatedSess : s))
        );
      }
    }
  }, [julesMessages, activeJulesSession, setActiveJulesSession]);

  return {
    julesApiKey,
    handleSaveJulesApiKey,
    julesSessions,
    activeJulesSession,
    setActiveJulesSession,
    julesMessages,
    setJulesMessages,
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
