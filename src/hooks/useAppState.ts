import { useServices } from "../services/ServiceContext";
import { useState, useEffect } from "react";
import { useAppAuth } from "./useAppAuth";
import { usePromptTemplates } from "./usePromptTemplates";

import { useChatSession } from "./useChatSession";
import { useProjectManager } from "./useProjectManager";
import { useUIState } from "./useUIState";
import { useModelConfig } from "./useModelConfig";
import { PromptType, ChatMessage, ChatSession, SavedPrompt } from "../types";



export function useAppState() {
  // External Services
  const { chatHistoryService, appAuthManager, promptTemplateService, draftStateService, projectService, platformService, timeProvider } = useServices();

  // Load initial app draft safely before deriving other states
  const initialActiveProjectId = projectService.getActiveProjectId();

  const initialDraft = draftStateService.loadDraftState(initialActiveProjectId);

  const [promptType, setPromptType] = useState<PromptType>(initialDraft.promptType);

  // Auth state
  const {
    googleUser,
    setGoogleUser,
    hasServerKey,
    setHasServerKey,
    customApiKey,
    setCustomApiKey,
    hasApiKey,
    handleSaveApiKey,
    refreshServerAuth,
  } = useAppAuth();


  const promptTemplates = usePromptTemplates(initialDraft.selectedTemplateIds || []);

  // Model Config
  const [config, setConfig] = useState(initialDraft.config);

  // Chat Session
  const chatSession = useChatSession(initialDraft, promptType, config, null, promptTemplateService);

  // UI State
  const uiState = useUIState();

  // Project Manager
  const projectManager = useProjectManager(
    chatSession,
    setPromptType,
    setConfig,
    setCustomApiKey,
    uiState.setCandidateClipboardKey,
    uiState.setClipboardToastKey,
    promptType,
    config
  );

  // Set chatSession activeProject correctly after init
  // We workaround `useChatSession` dependency here by directly linking activeProject inside effects,
  // or by passing the project info to it if possible. We will re-read activeProject
  const activeProject = projectManager.activeProject;

  // Model Config
  const modelConfig = useModelConfig(customApiKey);

  const handleLoadPrompt = (prompt: SavedPrompt) => {
    const validPromptTypes: PromptType[] = ["chat", "code", "stubs"];
    const targetType: PromptType = validPromptTypes.includes(prompt.type as PromptType)
      ? (prompt.type as PromptType)
      : "chat";
    setPromptType(targetType);
    setConfig(prompt.config);
    if (prompt.messages && prompt.messages.length > 0) {
      chatSession.setMessages(prompt.messages);
    }
  };

  const handleSaveApiKeyWithModels = (key: string) => {
    handleSaveApiKey(key);
    if (key.trim()) {
      modelConfig.refreshModels(key.trim(), true);
    }
  };




  const handleSelectChatSession = (session: ChatSession, onStopStream?: () => void) => {
    if (onStopStream) {
      onStopStream();
    }
    chatSession.setCurrentSessionId(session.id);
    chatSession.setMessages(session.messages || []);
    if (session.model) {
      setConfig((prev) => ({ ...prev, model: session.model! }));
    }
  };

  // Draft Save Effect
  useEffect(() => {
    const timeout = platformService.setTimeout(() => {
      draftStateService.saveDraftState(
        {
          promptType,
          config,
          freeformText: chatSession.freeformText,
          structuredExamples: chatSession.structuredExamples,
          selectedTemplateIds: promptTemplates.selectedTemplateIds,
          messages: chatSession.messages,
        },
        activeProject?.id
      );
    }, 500);
    return () => platformService.clearTimeout(timeout);
  }, [promptType, config, chatSession.freeformText, chatSession.structuredExamples, chatSession.messages, promptTemplates.selectedTemplateIds, activeProject?.id, platformService]);

  // Chat Session Persistence Effect
  useEffect(() => {
    if (chatSession.messages && chatSession.messages.length > 0 && chatSession.currentSessionId) {
      const hasMeaningfulContent = chatSession.messages.some(
        (m: ChatMessage) => m.text.trim().length > 0 || (m.images && m.images.length > 0)
      );
      if (hasMeaningfulContent) {
        chatHistoryService.saveChatSession(
          {
            id: chatSession.currentSessionId,
            title: chatHistoryService.generateSessionTitle(chatSession.messages),
            messages: chatSession.messages,
            createdAt: timeProvider.now(),
            updatedAt: timeProvider.now(),
            model: config.model,
            projectId: activeProject?.id,
          },
          activeProject?.id
        );
      }
    }
  }, [chatSession.messages, chatSession.currentSessionId, activeProject?.id, config.model]);

  // Init Effects
  useEffect(() => {
    chatHistoryService.purgeMockSessionsFromStorage();


  }, [appAuthManager, chatHistoryService]);


  return {
    ...projectManager,
    ...uiState,
    isTemplateDrawerOpen: promptTemplates.isTemplateDrawerOpen,
    setIsTemplateDrawerOpen: promptTemplates.setIsTemplateDrawerOpen,
    selectedTemplateIds: promptTemplates.selectedTemplateIds,
    setSelectedTemplateIds: promptTemplates.setSelectedTemplateIds,
    handleToggleTemplate: promptTemplates.handleToggleTemplate,
    handleRemoveTemplate: promptTemplates.handleRemoveTemplate,
    handleClearAllTemplates: promptTemplates.handleClearAllTemplates,

    models: modelConfig.models,
    setModels: modelConfig.setModels,
    config,
    setConfig,
    handleLoadPrompt,

    promptType,
    setPromptType,

    googleUser,
    setGoogleUser,
    hasServerKey,
    setHasServerKey,
    customApiKey,
    setCustomApiKey,
    hasApiKey,
    handleSaveApiKey: handleSaveApiKeyWithModels,
    refreshServerAuth,

    currentSessionId: chatSession.currentSessionId,
    setCurrentSessionId: chatSession.setCurrentSessionId,
    messages: chatSession.messages,
    setMessages: chatSession.setMessages,
    freeformText: chatSession.freeformText,
    structuredExamples: chatSession.structuredExamples,
    savedPrompts: chatSession.savedPrompts,
    setSavedPrompts: chatSession.setSavedPrompts,
    handleStartNewChat: chatSession.handleStartNewChat,
    handleSelectChatSession,
    handleSaveCurrentPrompt: chatSession.handleSaveCurrentPrompt,
    handleDeleteSavedPrompt: chatSession.handleDeleteSavedPrompt,
    handleBulkDeleteSavedPrompts: chatSession.handleBulkDeleteSavedPrompts
  };
}
