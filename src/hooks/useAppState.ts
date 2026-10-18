import { clearAllChatSessions } from "../services/chatHistoryService";
import { useState, useEffect } from "react";
import { usePromptTemplates } from "./usePromptTemplates";
import { useChatSession } from "./useChatSession";
import {
  PromptType,
  DeviceFrameMode,
  PromptConfig,
  ChatMessage,
  SavedPrompt,
  ModelInfo,
  GoogleUser,
  ProjectInfo,
  ChatSession,
} from "../types";
import {
  saveChatSession,
  generateSessionTitle,
  purgeMockSessionsFromStorage,
} from "../services/chatHistoryService";
import {
  getStoredGoogleUser,
  fetchServerCurrentUser,
  initiateGoogleLogin,
  logoutGoogleUser,
  initAuth,
} from "../services/googleAuth";
import {
  CURATED_MODELS,
  isDeprecatedOrUnusableModel,
  sanitizeModelId,
  fetchModels
} from "../utils/modelCatalog";
import {
  loadStoredApiKey,
  saveStoredApiKey,
  loadDraftState,
  saveDraftState,
  getActiveProject,
  loadStoredProjects,
  setActiveProjectId,
  updateStoredProject,
  deleteStoredProject,
  bulkDeleteStoredProjects,
} from "../utils/storage";
import {
  SpeechSettings,
  loadSpeechSettings,
} from "../services/speechVoices";
import { SettingsTab } from "../types";
import { getSafeWindow } from "../utils/platform";
import { fetchServerHealth } from "../services/auth";

export function useAppState() {
  // Phase 3: Active Project & Projects vault
  const [projects, setProjects] = useState<ProjectInfo[]>(() => loadStoredProjects());
  const [activeProject, setActiveProject] = useState<ProjectInfo | null>(() => getActiveProject());

  // Load project-scoped draft state for crash/reload recovery
  const initialDraft = loadDraftState(activeProject?.id);

  // Navigation & Mode states
  const [promptType, setPromptType] = useState<PromptType>(initialDraft.promptType);
  const [deviceMode, setDeviceMode] = useState<DeviceFrameMode>("responsive");
  const [showBottomNav, setShowBottomNav] = useState(false);
  const [showTunerSheet, setShowTunerSheet] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("account");
  const [speechSettings, setSpeechSettings] = useState<SpeechSettings>(() =>
    loadSpeechSettings()
  );

  // In-App Browser / Import states
  const [showCustomTabBrowser, setShowCustomTabBrowser] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [candidateClipboardKey, setCandidateClipboardKey] = useState<string>("");
  const [clipboardToastKey, setClipboardToastKey] = useState<string | null>(null);

  // Models & Server Key state
  const [models, setModels] = useState<ModelInfo[]>(CURATED_MODELS);
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(() => getStoredGoogleUser());
  const [hasServerKey, setHasServerKey] = useState(false);
  const [customApiKey, setCustomApiKey] = useState<string>(() => loadStoredApiKey());
  const hasApiKey = Boolean(googleUser || customApiKey.trim() || hasServerKey);

  // Prompt Configuration state - ensure model is never deprecated/unusable
  const [config, setConfig] = useState<PromptConfig>(() => ({
    ...initialDraft.config,
    model: sanitizeModelId(initialDraft.config?.model),
  }));

  // Jules
  const [showJulesDrawer, setShowJulesDrawer] = useState(false);
  const [browserService, setBrowserService] = useState<"aistudio" | "jules">("aistudio");

  // Sub-hooks
  const promptTemplates = usePromptTemplates();
  const chatSession = useChatSession(initialDraft, promptType, config, activeProject);

  // Actions

  const handleOpenSettings = (tab: SettingsTab = "account") => {
    setSettingsTab(tab);
    setShowSettingsModal(true);
  };

  const handleGoogleLogin = async (email?: string, name?: string) => {
    const user = await initiateGoogleLogin(email, name);
    if (user) {
      setGoogleUser(user);
      // Re-fetch live models with the authenticated Google credentials
      const key = customApiKey || loadStoredApiKey();

      fetchModels(key, true)
        .then((data) => {
          if (data?.models && Array.isArray(data.models) && data.models.length > 0) {
            const cleaned = data.models.filter((m: ModelInfo) => !isDeprecatedOrUnusableModel(m.id));
            if (cleaned.length > 0) {
              setModels(cleaned);
            }
          }
        })
        .catch(() => {});
    }
  };

  const handleGoogleLogout = async () => {
    await logoutGoogleUser();
    setGoogleUser(null);
  };

  const handleSaveApiKey = (key: string) => {
    setCustomApiKey(key);
    saveStoredApiKey(key);
    if (key.trim()) {
      fetchModels(key.trim(), true)
        .then((data) => {
          if (data?.models && Array.isArray(data.models) && data.models.length > 0) {
            setModels(data.models);
          }
        })
        .catch(() => {});
    }
  };

  const handleProjectActivated = (project: ProjectInfo, onStopStream?: () => void) => {
    if (onStopStream) {
      onStopStream();
    }

    // Persist current draft under outgoing active project
    saveDraftState(
      {
        promptType,
        config,
        freeformText: chatSession.freeformText,
        structuredExamples: chatSession.structuredExamples,
        messages: chatSession.messages,
      },
      activeProject?.id
    );

    // Mark new project active in storage & local state
    setActiveProjectId(project.id);
    setActiveProject(project);
    setCustomApiKey(project.apiKey);
    saveStoredApiKey(project.apiKey);

    // Load incoming project's scoped draft state
    const targetDraft = loadDraftState(project.id);
    setPromptType(targetDraft.promptType);
    setConfig({
      ...targetDraft.config,
      ...(project.defaultModel ? { model: project.defaultModel } : {}),
    });
    if (targetDraft.messages && targetDraft.messages.length > 0) {
      chatSession.setMessages(targetDraft.messages);
    } else {
      chatSession.setMessages([]);
    }

    // Synchronize project list & clear transient toasts
    setProjects(loadStoredProjects());
    setCandidateClipboardKey("");
    setClipboardToastKey(null);
    chatSession.setCurrentSessionId(`sess_${Date.now()}`);
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

  const handleRenameProject = (id: string, newName: string) => {
    updateStoredProject(id, { name: newName });
    const updated = loadStoredProjects();
    setProjects(updated);
    if (activeProject?.id === id) {
      setActiveProject((prev) => (prev ? { ...prev, name: newName } : null));
    }
  };

  const handleDeleteProject = (id: string, onStopStream?: () => void) => {
    deleteStoredProject(id);
    try {
      clearAllChatSessions(id);
    } catch(e) {
      console.error("Failed to clean up chat sessions", e);
    }
    const updated = loadStoredProjects();
    setProjects(updated);
    if (activeProject?.id === id) {
      if (updated.length > 0) {
        handleProjectActivated(updated[0], onStopStream);
      } else {
        setActiveProject(null);
        setCustomApiKey("");
        saveStoredApiKey("");
        chatSession.setMessages([]);
      }
    }
  };

  const handleBulkDeleteProjects = (ids: string[], onStopStream?: () => void) => {
    bulkDeleteStoredProjects(ids);
    try {
      ids.forEach(id => clearAllChatSessions(id));
    } catch(e) {
      console.error("Failed to clean up chat sessions", e);
    }
    const updated = loadStoredProjects();
    setProjects(updated);

    if (activeProject && ids.includes(activeProject.id)) {
      if (updated.length > 0) {
        handleProjectActivated(updated[0], onStopStream);
      } else {
        setActiveProject(null);
        setCustomApiKey("");
        saveStoredApiKey("");
        chatSession.setMessages([]);
      }
    }
  };

  const refreshServerAuth = async (): Promise<boolean> => {
    try {
      const data = await fetchServerHealth();
      const hasKey = Boolean(data.hasServerApiKey);
      setHasServerKey(hasKey);
      return hasKey;
    } catch {
      return false;
    }
  };

  const handleLoadPrompt = (prompt: SavedPrompt) => {
    const validPromptTypes: PromptType[] = ["chat", "code", "jules", "stubs"];
    const targetType: PromptType = validPromptTypes.includes(prompt.type as PromptType)
      ? (prompt.type as PromptType)
      : "chat";
    setPromptType(targetType);
    setConfig(prompt.config);
    if (prompt.messages && prompt.messages.length > 0) {
      chatSession.setMessages(prompt.messages);
    }
  };



  // Effects
  useEffect(() => {
    const timeout = setTimeout(() => {
      saveDraftState(
        {
          promptType,
          config,
          freeformText: chatSession.freeformText,
          structuredExamples: chatSession.structuredExamples,
          messages: chatSession.messages,
        },
        activeProject?.id
      );
    }, 500);
    return () => clearTimeout(timeout);
  }, [promptType, config, chatSession.freeformText, chatSession.structuredExamples, chatSession.messages, activeProject?.id]);

  useEffect(() => {
    if (chatSession.messages && chatSession.messages.length > 0 && chatSession.currentSessionId) {
      const hasMeaningfulContent = chatSession.messages.some(
        (m: ChatMessage) => m.text.trim().length > 0 || (m.images && m.images.length > 0)
      );
      if (hasMeaningfulContent) {
        saveChatSession(
          {
            id: chatSession.currentSessionId,
            title: generateSessionTitle(chatSession.messages),
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

  useEffect(() => {
    purgeMockSessionsFromStorage();
  }, []);

  useEffect(() => {
    fetchServerHealth()
      .then((data) => {
        if (data.hasServerApiKey) {
          setHasServerKey(true);
        }
      })
      .catch(() => {});

    fetchServerCurrentUser().then((user: GoogleUser | null) => {
      if (user) {
        setGoogleUser(user);
      }
    });

    const storedKey = loadStoredApiKey();
    fetchModels(storedKey)
      .then((data) => {
        if (data?.models && Array.isArray(data.models) && data.models.length > 0) {
          const cleaned = data.models.filter((m: ModelInfo) => !isDeprecatedOrUnusableModel(m.id));
          if (cleaned.length > 0) {
            setModels(cleaned);
          }
        }
      })
      .catch(() => {});

    const win = getSafeWindow();
    if (win && win.innerWidth >= 1024) {
      setDeviceMode("pixel");
    }

    const unsubscribeAuth = initAuth((user) => {
      if (user) {
        setGoogleUser(user);
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  return {
    projects,
    setProjects,
    activeProject,
    setActiveProject,
    promptType,
    setPromptType,
    deviceMode,
    setDeviceMode,
    showBottomNav,
    setShowBottomNav,
    showTunerSheet,
    setShowTunerSheet,
    showSettingsModal,
    setShowSettingsModal,
    settingsTab,
    setSettingsTab,
    speechSettings,
    setSpeechSettings,
    showCustomTabBrowser,
    setShowCustomTabBrowser,
    showImportModal,
    setShowImportModal,
    candidateClipboardKey,
    setCandidateClipboardKey,
    clipboardToastKey,
    setClipboardToastKey,
    isTemplateDrawerOpen: promptTemplates.isTemplateDrawerOpen,
    setIsTemplateDrawerOpen: promptTemplates.setIsTemplateDrawerOpen,
    selectedTemplateIds: promptTemplates.selectedTemplateIds,
    setSelectedTemplateIds: promptTemplates.setSelectedTemplateIds,
    models,
    setModels,
    googleUser,
    setGoogleUser,
    hasServerKey,
    setHasServerKey,
    customApiKey,
    setCustomApiKey,
    hasApiKey,
    config,
    setConfig,
    currentSessionId: chatSession.currentSessionId,
    setCurrentSessionId: chatSession.setCurrentSessionId,
    messages: chatSession.messages,
    setMessages: chatSession.setMessages,
    freeformText: chatSession.freeformText,
    structuredExamples: chatSession.structuredExamples,
    savedPrompts: chatSession.savedPrompts,
    setSavedPrompts: chatSession.setSavedPrompts,
    showJulesDrawer,
    setShowJulesDrawer,
    browserService,
    setBrowserService,
    handleToggleTemplate: promptTemplates.handleToggleTemplate,
    handleRemoveTemplate: promptTemplates.handleRemoveTemplate,
    handleClearAllTemplates: promptTemplates.handleClearAllTemplates,
    handleOpenSettings,
    handleGoogleLogin,
    handleGoogleLogout,
    handleSaveApiKey,
    handleProjectActivated,
    handleStartNewChat: chatSession.handleStartNewChat,
    handleSelectChatSession,
    handleRenameProject,
    handleDeleteProject,
    handleBulkDeleteProjects,
    refreshServerAuth,
    handleLoadPrompt,
    handleSaveCurrentPrompt: chatSession.handleSaveCurrentPrompt,
    handleDeleteSavedPrompt: chatSession.handleDeleteSavedPrompt,
    handleBulkDeleteSavedPrompts: chatSession.handleBulkDeleteSavedPrompts
  };
}
