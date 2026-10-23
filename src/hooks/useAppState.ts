import { useState, useEffect } from "react";
import { usePromptTemplates } from "./usePromptTemplates";

import { useServices } from "../services/ServiceContext";
import { useChatSession } from "./useChatSession";
import { useProjectManager } from "./useProjectManager";
import { useUIState } from "./useUIState";
import { useModelConfig } from "./useModelConfig";
import { PromptType, ChatMessage, ChatSession } from "../types";
import {
  loadStoredApiKey,
  saveStoredApiKey,
  loadDraftState,
  saveDraftState,
} from "../utils/storage";

import { fetchModels, isDeprecatedOrUnusableModel } from "../utils/modelCatalog";
import { ModelInfo } from "../types";

export function useAppState() {
  const { chatHistoryService } = useServices();
  // Load initial app draft safely before deriving other states
  const initialActiveProjectId = (() => {
    try {
      const stored = localStorage.getItem("aistudio_active_project_id");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })();
  const initialDraft = loadDraftState(initialActiveProjectId);

  const [promptType, setPromptType] = useState<PromptType>(initialDraft.promptType);

  // Auth state (could use useAppAuth instead but keeping logic unified here for compatibility if needed,
  // or refactoring completely)
  const [googleUser, setGoogleUser] = useState(() => googleAuthService.loadStoredGoogleUser());
  const [hasServerKey, setHasServerKey] = useState(false);
  const [customApiKey, setCustomApiKey] = useState(() => loadStoredApiKey());
  const hasApiKey = Boolean(googleUser || customApiKey.trim() || hasServerKey);

  // External Services
  const { googleAuthService, authService, promptTemplateService } = useServices();

  const promptTemplates = usePromptTemplates(initialDraft.selectedTemplateIds || []);

  // Model Config
  const [config, setConfig] = useState(initialDraft.config);

  // Chat Session
  const chatSession = useChatSession(initialDraft, promptType, config, null as unknown as import("../types").ProjectInfo, promptTemplateService);

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
  const modelConfig = useModelConfig(initialDraft.config, customApiKey, chatSession);

  // Sync back config to models if it changed
  useEffect(() => {
    setConfig(modelConfig.config);
  }, [modelConfig.config]);

  const handleGoogleLogin = async (email?: string, name?: string) => {
    const user = await googleAuthService.initiateGoogleLogin(email, name);
    if (user) {
      setGoogleUser(user);
      const key = customApiKey || loadStoredApiKey();
      fetchModels(key, true)
        .then((data) => {
          if (data?.models && Array.isArray(data.models) && data.models.length > 0) {
            const cleaned = data.models.filter((m: ModelInfo) => !isDeprecatedOrUnusableModel(m.id));
            if (cleaned.length > 0) {
              modelConfig.setModels(cleaned);
            }
          }
        })
        .catch(() => {});
    }
  };

  const handleGoogleLogout = async () => {
    await googleAuthService.logoutGoogleUser();
    setGoogleUser(null);
  };

  const handleSaveApiKey = (key: string) => {
    setCustomApiKey(key);
    saveStoredApiKey(key);
    if (key.trim()) {
      fetchModels(key.trim(), true)
        .then((data) => {
          if (data?.models && Array.isArray(data.models) && data.models.length > 0) {
            modelConfig.setModels(data.models);
          }
        })
        .catch(() => {});
    }
  };

  const refreshServerAuth = async (): Promise<boolean> => {
    try {
      const data = await authService.fetchServerHealth();
      const hasKey = Boolean(data.hasServerApiKey);
      setHasServerKey(hasKey);
      return hasKey;
    } catch {
      return false;
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
    const timeout = setTimeout(() => {
      saveDraftState(
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
    return () => clearTimeout(timeout);
  }, [promptType, config, chatSession.freeformText, chatSession.structuredExamples, chatSession.messages, promptTemplates.selectedTemplateIds, activeProject?.id]);

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
            createdAt: Date.now(),
            updatedAt: Date.now(),
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

    authService.fetchServerHealth()
      .then((data) => {
        if (data.hasServerApiKey) setHasServerKey(true);
      })
      .catch(() => {});

    googleAuthService.fetchCurrentGoogleUser().then((user) => {
      if (user) setGoogleUser(user);
    });

    const unsubscribeAuth = googleAuthService.initAuth((user) => {
      if (user) setGoogleUser(user);
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

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
    handleLoadPrompt: (p: import("../types").SavedPrompt) => modelConfig.handleLoadPrompt(p, setPromptType),

    promptType,
    setPromptType,

    googleUser,
    setGoogleUser,
    hasServerKey,
    setHasServerKey,
    customApiKey,
    setCustomApiKey,
    hasApiKey,
    handleGoogleLogin,
    handleGoogleLogout,
    handleSaveApiKey,
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
