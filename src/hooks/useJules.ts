import { useServices } from "../services/ServiceContext";
import { useStore } from "./useStore";
import { useState, useCallback, useEffect } from "react";
import { JulesSession, MessageAttachment } from "../types";

export function useJules() {
  const { julesStorageService, julesSessionOrchestrator } = useServices();
  const julesSessionsManager = julesStorageService.julesSessionsManager;

  const [julesApiKey, setJulesApiKey] = useState<string>(() => julesStorageService.loadStoredJulesApiKey());

  const julesStore = useStore(julesSessionsManager);
  const julesSessions = julesStore.items;
  const activeJulesSession = julesStore.activeItem;

  const orchestratorState = useStore(julesSessionOrchestrator.getStateStore());
  const isJulesExecuting = orchestratorState.isExecuting;
  const isApprovingJulesPlan = orchestratorState.isApprovingPlan;

  const julesMessages = activeJulesSession?.messages || [];

  useEffect(() => {
    julesStorageService.fetchJulesSessionsFromServer();
  }, []);

  const handleSaveJulesApiKey = useCallback((key: string) => {
    setJulesApiKey(key);
    julesStorageService.saveStoredJulesApiKey(key);
  }, []);

  const handleStopJulesPolling = useCallback(() => {
    julesSessionOrchestrator.stopPolling();
  }, []);

  const handleClearJulesMessages = useCallback(() => {
    julesSessionOrchestrator.clearMessages();
  }, []);

  const handleRegenerateJulesTask = useCallback(async () => {
    return julesSessionOrchestrator.regenerateTask();
  }, []);

  const handleSendJulesMessage = useCallback(
    async (
      text: string,
      attachments: MessageAttachment[] = [],
      templateIds: string[] = [],
      rawUserText?: string
    ) => {
      return julesSessionOrchestrator.dispatchTask(text, attachments, templateIds, rawUserText);
    },
    []
  );

  const handleApproveJulesPlan = useCallback(
    async (taskId: string) => {
      await julesSessionOrchestrator.approvePlan(taskId);
    },
    []
  );

  const handleRejectJulesPlan = useCallback(
    async (taskId: string) => {
      await julesSessionOrchestrator.rejectPlan(taskId);
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
    handleBulkDeleteJulesSessions,
    handleRegenerateJulesTask
  };
}
