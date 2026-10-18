import { useAppAuth } from "./useAppAuth";
import { clearAllChatSessions } from "../services/chatHistoryService";
import { useState, useEffect } from "react";
import {
  PromptType,
  DeviceFrameMode,
  PromptConfig,
  ChatMessage,
  StructuredExample,
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
import { bulkDeleteCustomTemplates } from "../services/promptTemplateService";
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
  loadSavedPrompts,
  persistSavedPrompts,
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
import { generateUniqueId } from "../utils/idGenerator";

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

  // Prompt Templates State (Global to header & chat)
  const [isTemplateDrawerOpen, setIsTemplateDrawerOpen] = useState(false);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);

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

  // Chat state & active session tracking
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => `sess_${Date.now()}`);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (initialDraft.messages && initialDraft.messages.length > 0) {
      return initialDraft.messages;
    }
    return [];
  });

  // Mobile IDE compatibility state
  const [freeformText] = useState(initialDraft.freeformText);
  const [structuredExamples] = useState<StructuredExample[]>(
    initialDraft.structuredExamples
  );

  // Library / saved prompts
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>(() => loadSavedPrompts());

  // Jules
  const [showJulesDrawer, setShowJulesDrawer] = useState(false);
  const [browserService, setBrowserService] = useState<"aistudio" | "jules">("aistudio");

  // Actions
  const handleToggleTemplate = (templateId: string) => {
    setSelectedTemplateIds((prev) =>
      prev.includes(templateId)
        ? prev.filter((id) => id !== templateId)
        : [...prev, templateId]
    );
  };

  const handleRemoveTemplate = (templateId: string) => {
    setSelectedTemplateIds((prev) => prev.filter((id) => id !== templateId));
  };

  const handleClearAllTemplates = () => {
    setSelectedTemplateIds([]);
  };

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
        freeformText,
        structuredExamples,
        messages,
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
      setMessages(targetDraft.messages);
    } else {
      setMessages([]);
    }

    // Synchronize project list & clear transient toasts
    setProjects(loadStoredProjects());
    setCandidateClipboardKey("");
    setClipboardToastKey(null);
    setCurrentSessionId(`sess_${Date.now()}`);
  };

  const handleStartNewChat = (onStopStream?: () => void) => {
    if (onStopStream) {
      onStopStream();
    }
    const newSessionId = generateUniqueId("sess");
    setCurrentSessionId(newSessionId);
    setMessages([]);
  };

  const handleSelectChatSession = (session: ChatSession, onStopStream?: () => void) => {
    if (onStopStream) {
      onStopStream();
    }
    setCurrentSessionId(session.id);
    setMessages(session.messages || []);
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
        setMessages([]);
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
        setMessages([]);
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
      setMessages(prompt.messages);
    }
  };

  const handleSaveCurrentPrompt = (title: string) => {
    const newSaved: SavedPrompt = {
      id: generateUniqueId("saved"),
      title,
      type: promptType,
      config: { ...config },
      messages: [...messages],
      updatedAt: Date.now(),
      projectId: activeProject?.id,
    };

    const updated = [newSaved, ...savedPrompts];
    setSavedPrompts(updated);
    persistSavedPrompts(updated);
  };

  const handleDeleteSavedPrompt = (id: string) => {
    const updated = savedPrompts.filter((p) => p.id !== id);
    setSavedPrompts(updated);
    persistSavedPrompts(updated);
  };

  const handleBulkDeleteSavedPrompts = (ids: string[]) => {
    const idSet = new Set(ids);
    const updated = savedPrompts.filter((p) => !idSet.has(p.id));
    setSavedPrompts(updated);
    persistSavedPrompts(updated);
    bulkDeleteCustomTemplates(ids);
  };

  // Effects
  useEffect(() => {
    const timeout = setTimeout(() => {
      saveDraftState(
        {
          promptType,
          config,
          freeformText,
          structuredExamples,
          messages,
        },
        activeProject?.id
      );
    }, 500);
    return () => clearTimeout(timeout);
  }, [promptType, config, freeformText, structuredExamples, messages, activeProject?.id]);

  useEffect(() => {
    if (messages && messages.length > 0 && currentSessionId) {
      const hasMeaningfulContent = messages.some(
        (m) => m.text.trim().length > 0 || (m.images && m.images.length > 0)
      );
      if (hasMeaningfulContent) {
        saveChatSession(
          {
            id: currentSessionId,
            title: generateSessionTitle(messages),
            messages,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            model: config.model,
            projectId: activeProject?.id,
          },
          activeProject?.id
        );
      }
    }
  }, [messages, currentSessionId, activeProject?.id, config.model]);

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
    isTemplateDrawerOpen,
    setIsTemplateDrawerOpen,
    selectedTemplateIds,
    setSelectedTemplateIds,
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
    currentSessionId,
    setCurrentSessionId,
    messages,
    setMessages,
    freeformText,
    structuredExamples,
    savedPrompts,
    setSavedPrompts,
    showJulesDrawer,
    setShowJulesDrawer,
    browserService,
    setBrowserService,
    handleToggleTemplate,
    handleRemoveTemplate,
    handleClearAllTemplates,
    handleOpenSettings,
    handleGoogleLogin,
    handleGoogleLogout,
    handleSaveApiKey,
    handleProjectActivated,
    handleStartNewChat,
    handleSelectChatSession,
    handleRenameProject,
    handleDeleteProject,
    handleBulkDeleteProjects,
    refreshServerAuth,
    handleLoadPrompt,
    handleSaveCurrentPrompt,
    handleDeleteSavedPrompt,
    handleBulkDeleteSavedPrompts
  };
}
