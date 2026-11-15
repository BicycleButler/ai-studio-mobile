import { useServices } from "../services/ServiceContext";
import { useState, useEffect, useRef } from "react";
import { useAppAuth } from "./useAppAuth";
import { usePromptTemplates } from "./usePromptTemplates";

import { useChatSession } from "./useChatSession";
import { useProjectManager } from "./useProjectManager";
import { useUIState } from "./useUIState";
import { useModelConfig } from "./useModelConfig";
import { PromptType, ChatMessage, ChatSession, SavedPrompt, ProjectInfo } from "../types";



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
    pendingChatSaveRef.current?.();
    chatSession.setCurrentSessionId(session.id);
    chatSession.setMessages(session.messages || []);
    if (session.model) {
      setConfig((prev) => ({ ...prev, model: session.model! }));
    }
  };

  const handleStartNewChatWithFlush = (onStopStream?: () => void) => {
    if (onStopStream) {
      onStopStream();
    }
    pendingChatSaveRef.current?.();
    chatSession.handleStartNewChat();
  };

  const handleProjectActivatedWithFlush = (project: ProjectInfo, onStopStream?: () => void) => {
    if (onStopStream) {
      onStopStream();
    }
    pendingChatSaveRef.current?.();
    projectManager.handleProjectActivated(project);
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

  const pendingChatSaveRef = useRef<(() => void) | null>(null);

  // Flush any pending debounced chat save on pagehide or unmount
  useEffect(() => {
    if (!platformService.isBrowserEnv()) {
      return () => {
        pendingChatSaveRef.current?.();
      };
    }
    const flush = () => {
      pendingChatSaveRef.current?.();
    };
    const removePageHide = platformService.addEventListener("pagehide", flush);
    return () => {
      removePageHide();
      pendingChatSaveRef.current?.();
    };
  }, [platformService]);

  // Chat Session Persistence Effect (debounced while streaming, immediate on completion)
  useEffect(() => {
    if (!chatSession.messages || chatSession.messages.length === 0 || !chatSession.currentSessionId) {
      pendingChatSaveRef.current = null;
      return;
    }

    const hasMeaningfulContent = chatSession.messages.some(
      (m: ChatMessage) => m.text.trim().length > 0 || (m.images && m.images.length > 0)
    );
    if (!hasMeaningfulContent) {
      pendingChatSaveRef.current = null;
      return;
    }

    const sessionId = chatSession.currentSessionId;
    const projectId = activeProject?.id;
    const messagesSnapshot = chatSession.messages;
    const modelSnapshot = config.model;
    const isStreaming = messagesSnapshot.some((m) => m.isStreaming);

    const persistSession = () => {
      pendingChatSaveRef.current = null;
      const existing = chatHistoryService.getChatSessionById(sessionId, projectId);
      const now = timeProvider.now();
      chatHistoryService.saveChatSession(
        {
          id: sessionId,
          title: chatHistoryService.generateSessionTitle(messagesSnapshot),
          messages: messagesSnapshot,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
          model: modelSnapshot,
          projectId,
        },
        projectId
      );
    };

    if (!isStreaming) {
      persistSession();
      return;
    }

    pendingChatSaveRef.current = persistSession;
    const timeout = platformService.setTimeout(persistSession, 1000);
    return () => {
      platformService.clearTimeout(timeout);
    };
  }, [chatSession.messages, chatSession.currentSessionId, activeProject?.id, config.model, chatHistoryService, platformService, timeProvider]);

  // Init Effects
  useEffect(() => {
    chatHistoryService.purgeMockSessionsFromStorage();


  }, [appAuthManager, chatHistoryService]);


  return {
    ...projectManager,
    handleProjectActivated: handleProjectActivatedWithFlush,
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
    handleStartNewChat: handleStartNewChatWithFlush,
    handleSelectChatSession,
    handleSaveCurrentPrompt: chatSession.handleSaveCurrentPrompt,
    handleDeleteSavedPrompt: chatSession.handleDeleteSavedPrompt,
    handleBulkDeleteSavedPrompts: chatSession.handleBulkDeleteSavedPrompts
  };
}
