import { useServices } from "../services/ServiceContext";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAppAuth } from "./useAppAuth";
import { usePromptTemplates } from "./usePromptTemplates";

import { useChatSession } from "./useChatSession";
import { useProjectManager } from "./useProjectManager";
import { useUIState } from "./useUIState";
import { useModelConfig } from "./useModelConfig";
import { PromptType, ChatMessage, ChatSession, SavedPrompt, ProjectInfo } from "../types";
import type { DraftState } from "../utils/storage/draftState";



export function useAppState() {
  // External Services
  const { chatHistoryService, appAuthManager, promptTemplateService, draftStateService, projectService, savedPromptsService, firestoreSyncService, platformService, timeProvider, logger } = useServices();

  // Load initial app draft once per hook mount instead of synchronously reading storage on every render
  const initialDraftRef = useRef<DraftState | null>(null);
  if (initialDraftRef.current === null) {
    const initialActiveProjectId = projectService.getActiveProjectId();
    initialDraftRef.current = draftStateService.loadDraftState(initialActiveProjectId);
  }
  const initialDraft = initialDraftRef.current;

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

  const {
    setMessages: setChatMessages,
    setCurrentSessionId: setChatSessionId,
    handleStartNewChat: startNewChatSession,
  } = chatSession;
  const { handleProjectActivated: activateProject } = projectManager;
  const { refreshModels } = modelConfig;

  const handleLoadPrompt = useCallback((prompt: SavedPrompt) => {
    const validPromptTypes: PromptType[] = ["chat", "code", "stubs"];
    const targetType: PromptType = validPromptTypes.includes(prompt.type as PromptType)
      ? (prompt.type as PromptType)
      : "chat";
    setPromptType(targetType);
    setConfig(prompt.config);
    if (prompt.messages && prompt.messages.length > 0) {
      setChatMessages(prompt.messages);
    }
  }, [setChatMessages]);

  const handleSaveApiKeyWithModels = useCallback((key: string) => {
    handleSaveApiKey(key);
    if (key.trim()) {
      refreshModels(key.trim(), true);
    }
  }, [handleSaveApiKey, refreshModels]);




  const pendingDraftSaveRef = useRef<(() => void) | null>(null);
  const pendingChatSaveRef = useRef<(() => void) | null>(null);
  const lastStreamSaveAtRef = useRef<number>(0);

  const handleSelectChatSession = useCallback((session: ChatSession, onStopStream?: () => void) => {
    if (onStopStream) {
      onStopStream();
    }
    pendingDraftSaveRef.current?.();
    pendingChatSaveRef.current?.();
    setChatSessionId(session.id);
    setChatMessages(session.messages || []);
    if (session.model) {
      setConfig((prev) => ({ ...prev, model: session.model! }));
    }
  }, [setChatSessionId, setChatMessages]);

  const handleStartNewChatWithFlush = useCallback((onStopStream?: () => void) => {
    if (onStopStream) {
      onStopStream();
    }
    pendingDraftSaveRef.current?.();
    pendingChatSaveRef.current?.();
    startNewChatSession();
  }, [startNewChatSession]);

  const handleProjectActivatedWithFlush = useCallback((project: ProjectInfo, onStopStream?: () => void) => {
    if (onStopStream) {
      onStopStream();
    }
    pendingDraftSaveRef.current?.();
    pendingChatSaveRef.current?.();
    activateProject(project);
  }, [activateProject]);

  // Draft Save Effect (debounced + flushable on background/unmount; wider window while actively streaming)
  useEffect(() => {
    const projectId = activeProject?.id;
    const isStreaming = chatSession.messages.some((m) => m.isStreaming);
    const draftSnapshot = {
      promptType,
      config,
      freeformText: chatSession.freeformText,
      structuredExamples: chatSession.structuredExamples,
      selectedTemplateIds: promptTemplates.selectedTemplateIds,
      messages: chatSession.messages,
    };
    const persistDraft = () => {
      pendingDraftSaveRef.current = null;
      draftStateService.saveDraftState(draftSnapshot, projectId);
    };
    pendingDraftSaveRef.current = persistDraft;
    const debounceMs = isStreaming ? 1500 : 500;
    const timeout = platformService.setTimeout(persistDraft, debounceMs);
    return () => platformService.clearTimeout(timeout);
  }, [promptType, config, chatSession.freeformText, chatSession.structuredExamples, chatSession.messages, promptTemplates.selectedTemplateIds, activeProject?.id, draftStateService, platformService]);

  // Flush any pending debounced draft/chat save on pagehide, visibility hidden, or unmount
  useEffect(() => {
    const flushAll = () => {
      pendingDraftSaveRef.current?.();
      pendingChatSaveRef.current?.();
    };
    if (!platformService.isBrowserEnv()) {
      return flushAll;
    }
    const handleVisibilityChange = () => {
      if (platformService.getDocument()?.visibilityState === "hidden") {
        flushAll();
      }
    };
    const removePageHide = platformService.addEventListener("pagehide", flushAll);
    const removeVisibility = platformService.addDocumentListener("visibilitychange", handleVisibilityChange);
    return () => {
      removePageHide();
      removeVisibility();
      flushAll();
    };
  }, [platformService]);

  // Chat Session Persistence Effect (throttled + debounced while streaming, immediate on completion)
  useEffect(() => {
    if (!chatSession.messages || chatSession.messages.length === 0 || !chatSession.currentSessionId) {
      pendingChatSaveRef.current = null;
      lastStreamSaveAtRef.current = 0;
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
      if (isStreaming) {
        lastStreamSaveAtRef.current = now;
      }
      const sessionToSave: ChatSession = {
        id: sessionId,
        title: chatHistoryService.generateSessionTitle(messagesSnapshot),
        messages: messagesSnapshot,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        model: modelSnapshot,
        projectId,
      };
      chatHistoryService.saveChatSession(sessionToSave, projectId);
      if (!isStreaming) {
        void firestoreSyncService?.syncChatSession(sessionToSave)?.catch((err) => {
          logger.warn("Background chat session sync failed:", err);
        });
      }
    };

    if (!isStreaming) {
      lastStreamSaveAtRef.current = 0;
      persistSession();
      return;
    }

    const now = timeProvider.now();
    if (lastStreamSaveAtRef.current === 0) {
      lastStreamSaveAtRef.current = now;
    } else if (now - lastStreamSaveAtRef.current >= 2000) {
      persistSession();
      return;
    }

    pendingChatSaveRef.current = persistSession;
    const timeout = platformService.setTimeout(persistSession, 1000);
    return () => {
      platformService.clearTimeout(timeout);
    };
  }, [chatSession.messages, chatSession.currentSessionId, activeProject?.id, config.model, chatHistoryService, firestoreSyncService, platformService, timeProvider, logger]);

  // Init & Authenticated Cloud Firestore Sync Effects
  useEffect(() => {
    chatHistoryService.purgeMockSessionsFromStorage();

    if (!firestoreSyncService) return;
    const unsubFirestore = firestoreSyncService.subscribeUserData({
      onRemotePrompts: (remotePrompts) => {
        if (remotePrompts.length === 0) return;
        const local = savedPromptsService.loadSavedPrompts();
        const mergedMap = new Map<string, SavedPrompt>(local.map((p) => [p.id, p]));
        for (const r of remotePrompts) {
          const existing = mergedMap.get(r.id);
          if (!existing || (r.updatedAt || 0) > (existing.updatedAt || 0)) {
            mergedMap.set(r.id, r);
          }
        }
        savedPromptsService.savedPromptsManager.collection.save(Array.from(mergedMap.values()), { skipSync: true });
      },
      onRemoteChatSessions: (remoteSessions) => {
        for (const r of remoteSessions) {
          const existing = chatHistoryService.getChatSessionById(r.id, r.projectId);
          if (!existing || (r.updatedAt || 0) > (existing.updatedAt || 0)) {
            chatHistoryService.saveChatSession(r, r.projectId, { preserveTimestamp: true });
          }
        }
      },
      onRemoteTemplates: (remoteTemplates) => {
        promptTemplateService.mergeRemoteTemplates?.(remoteTemplates);
      },
      onRemoteProjects: (remoteProjects) => {
        if (remoteProjects.length === 0) return;
        const local = projectService.projectsManager.getItems();
        const mergedMap = new Map<string, ProjectInfo>(local.map((p) => [p.id, p]));
        for (const r of remoteProjects) {
          const existing = mergedMap.get(r.id);
          if (!existing) {
            mergedMap.set(r.id, { ...r, apiKey: "" });
          } else if ((r.updatedAt || 0) > (existing.updatedAt || 0)) {
            mergedMap.set(r.id, { ...r, apiKey: existing.apiKey });
          }
        }
        projectService.projectsManager.collection.save(Array.from(mergedMap.values()), { skipSync: true });
      },
    });

    return () => {
      unsubFirestore();
    };
  }, [appAuthManager, chatHistoryService, firestoreSyncService, savedPromptsService, promptTemplateService, projectService, logger]);


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
