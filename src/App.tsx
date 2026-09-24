import React, { useState, useEffect, useRef } from "react";
import {
  PromptType,
  DeviceFrameMode,
  PromptConfig,
  ChatMessage,
  StructuredExample,
  SavedPrompt,
  ModelInfo,
  MessageAttachment,
  IncomingMessage,
  GoogleUser,
  ProjectInfo,
  ChatSession,
  JulesSession,
} from "./types";
import {
  saveChatSession,
  generateSessionTitle,
  purgeMockSessionsFromStorage,
} from "./services/chatHistoryService";
import {
  getStoredGoogleUser,
  fetchServerCurrentUser,
  initiateGoogleLogin,
  logoutGoogleUser,
  initAuth,
} from "./services/googleAuth";
import { TopAppBar } from "./components/TopAppBar";
import { ChatWorkspace } from "./components/ChatWorkspace";
import { MobileIDEWorkspace } from "./components/MobileIDEWorkspace";
import { StubsWorkspace } from "./components/StubsWorkspace";
import { TunerBottomSheet } from "./components/TunerBottomSheet";
import { UnifiedSettingsModal, SettingsTab } from "./components/UnifiedSettingsModal";
import { AndroidFrame } from "./components/AndroidFrame";
import { BottomNavBar } from "./components/BottomNavBar";
import { CustomTabBrowserModal } from "./components/CustomTabBrowserModal";
import { ImportProjectSheet } from "./components/ImportProjectSheet";
import { SecurePrivacyShield } from "./components/SecurePrivacyShield";
import { JulesSessionDrawer } from "./components/JulesSessionDrawer";
import { useGeminiStream } from "./hooks/useGeminiStream";
import {
  CURATED_MODELS,
  isDeprecatedOrUnusableModel,
  sanitizeModelId,
} from "./utils/modelCatalog";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { useClipboardKeySniffer } from "./hooks/useClipboardKeySniffer";
import { useWindowSecurity } from "./hooks/useWindowSecurity";
import { maskApiKey, clearClipboardSafe } from "./services/keyVerification";
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
  loadStoredJulesApiKey,
  saveStoredJulesApiKey,
  loadStoredJulesSessions,
  getActiveJulesSession,
  setActiveJulesSessionId,
  updateStoredJulesSession,
} from "./utils/storage";
import {
  dispatchJulesTask,
  pollJulesTask,
  approveJulesPlan,
} from "./services/julesService";
import {
  SpeechSettings,
  loadSpeechSettings,
  saveSpeechSettings,
} from "./services/speechVoices";
import { AlertCircle, AlertTriangle, Key, RefreshCw, WifiOff, X, Shield, ArrowRight, ExternalLink } from "lucide-react";
import { OfflineIndicator } from "./components/OfflineIndicator";

export default function App() {
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

  // Google Jules Autonomous Coding Agent state
  const [julesApiKey, setJulesApiKey] = useState<string>(() => loadStoredJulesApiKey());
  const [julesSessions, setJulesSessions] = useState<JulesSession[]>(() => loadStoredJulesSessions());
  const [activeJulesSession, setActiveJulesSession] = useState<JulesSession | null>(() => getActiveJulesSession());
  const [showJulesDrawer, setShowJulesDrawer] = useState(false);
  const [isJulesExecuting, setIsJulesExecuting] = useState(false);
  const [isApprovingJulesPlan, setIsApprovingJulesPlan] = useState(false);
  const [julesMessages, setJulesMessages] = useState<ChatMessage[]>(() => getActiveJulesSession()?.messages || []);
  const [browserService, setBrowserService] = useState<"aistudio" | "jules">("aistudio");
  const julesPollingRef = useRef<{ stop: () => void } | null>(null);

  const handleSaveJulesApiKey = (key: string) => {
    setJulesApiKey(key);
    saveStoredJulesApiKey(key);
  };

  const handleStopJulesPolling = () => {
    if (julesPollingRef.current) {
      julesPollingRef.current.stop();
      julesPollingRef.current = null;
    }
    setIsJulesExecuting(false);
  };

  const handleClearJulesMessages = () => {
    handleStopJulesPolling();
    setJulesMessages([]);
    if (activeJulesSession) {
      const updated = { ...activeJulesSession, messages: [], updatedAt: Date.now() };
      updateStoredJulesSession(updated);
      setActiveJulesSession(updated);
    }
  };

  const handleSendJulesMessage = async (
    promptText: string,
    _attachments?: MessageAttachment[],
    templateIds?: string[],
    rawUserText?: string
  ) => {
    if (!promptText.trim()) return;

    if (!julesApiKey.trim()) {
      handleOpenSettings("account");
      return;
    }

    let currentSession = activeJulesSession;
    if (!currentSession) {
      setShowJulesDrawer(true);
      return;
    }

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: "user",
      text: promptText,
      timestamp: Date.now(),
      templateIds,
      rawUserText,
    };

    const taskModelMsgId = `jules_${Date.now()}`;
    const initialModelMsg: ChatMessage = {
      id: taskModelMsgId,
      role: "model",
      text: `Dispatching task to Jules for ${currentSession.repository}...`,
      timestamp: Date.now(),
      julesActivity: {
        type: "plan",
        taskId: "pending",
        status: "planning",
        title: promptText.length > 55 ? promptText.slice(0, 52) + "..." : promptText,
        planDescription: `Jules is inspecting ${currentSession.repository} (branch: ${currentSession.branch}) and planning autonomous changes.`,
        steps: [
          { id: "s1", title: "Analyze workspace", description: "Cloning repository & analyzing workspace structure", status: "in_progress" },
          { id: "s2", title: "Formulate plan", description: "Formulating code edit plan", status: "pending" },
          { id: "s3", title: "Execute edits", description: "Executing code changes", status: "pending" },
          { id: "s4", title: "Create Pull Request", description: "Creating Pull Request", status: "pending" },
        ],
      },
    };

    const updatedMessages = [...julesMessages, userMsg, initialModelMsg];
    setJulesMessages(updatedMessages);

    // Persist to session
    const sessionWithMessages: JulesSession = {
      ...currentSession,
      updatedAt: Date.now(),
      messages: updatedMessages,
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
        prompt: promptText,
        branch: currentSession.branch,
        autoApprove: currentSession.autoApprovePlan,
      });

      const updatedActivityMsg: ChatMessage = {
        ...initialModelMsg,
        text: `Jules task created: #${dispatchedTask.id.slice(0, 8)}`,
        julesActivity: {
          type: "plan",
          taskId: dispatchedTask.id,
          status: dispatchedTask.status,
          title: dispatchedTask.title || initialModelMsg.julesActivity?.title,
          planDescription: dispatchedTask.planDescription,
          steps: dispatchedTask.steps || initialModelMsg.julesActivity?.steps,
          pullRequestUrl: dispatchedTask.pullRequestUrl,
          pullRequestNumber: dispatchedTask.pullRequestNumber,
          errorMessage: dispatchedTask.errorMessage,
        },
      };

      setJulesMessages((prev) =>
        prev.map((m) => (m.id === taskModelMsgId ? updatedActivityMsg : m))
      );

      // Start polling live proxy
      julesPollingRef.current = pollJulesTask(
        julesApiKey,
        dispatchedTask.id,
        (updatedTask) => {
          setJulesMessages((prev) => {
            const next = prev.map((m) => {
              if (m.id === taskModelMsgId && m.julesActivity) {
                return {
                  ...m,
                  text:
                    updatedTask.status === "completed"
                      ? `Task completed! Pull Request created for ${currentSession?.repository}.`
                      : updatedTask.status === "failed"
                      ? `Jules encountered an error while executing task.`
                      : updatedTask.status === "awaiting_approval"
                      ? `Plan ready. Awaiting approval to execute.`
                      : m.text,
                  julesActivity: {
                    ...m.julesActivity,
                    status: updatedTask.status,
                    steps: updatedTask.steps || m.julesActivity.steps,
                    planDescription: updatedTask.planDescription || m.julesActivity.planDescription,
                    diffStats: updatedTask.diffStats || m.julesActivity.diffStats,
                    pullRequestUrl: updatedTask.pullRequestUrl,
                    pullRequestNumber: updatedTask.pullRequestNumber,
                    errorMessage: updatedTask.errorMessage,
                  },
                };
              }
              return m;
            });

            if (currentSession) {
              const updatedSess = { ...currentSession, messages: next, updatedAt: Date.now() };
              updateStoredJulesSession(updatedSess);
            }
            return next;
          });

          if (updatedTask.status === "completed" || updatedTask.status === "failed") {
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
      const errMsg = err instanceof Error ? err.message : "Failed to dispatch Jules task";
      setJulesMessages((prev) =>
        prev.map((m) =>
          m.id === taskModelMsgId
            ? {
                ...m,
                error: errMsg,
                julesActivity: m.julesActivity
                  ? { ...m.julesActivity, status: "failed", errorMessage: errMsg }
                  : undefined,
              }
            : m
        )
      );
    }
  };

  const handleApproveJulesPlan = async (taskId: string) => {
    if (!julesApiKey.trim()) return;
    setIsApprovingJulesPlan(true);
    try {
      await approveJulesPlan(julesApiKey, taskId, true);
      setJulesMessages((prev) =>
        prev.map((m) => {
          if (m.julesActivity && m.julesActivity.taskId === taskId) {
            return {
              ...m,
              text: "Plan approved. Jules is executing changes and committing...",
              julesActivity: {
                ...m.julesActivity,
                status: "executing",
              },
            };
          }
          return m;
        })
      );
    } catch (err: unknown) {
      console.error("Failed to approve plan:", err);
    } finally {
      setIsApprovingJulesPlan(false);
    }
  };

  const handleRejectJulesPlan = async (taskId: string) => {
    if (!julesApiKey.trim()) return;
    try {
      await approveJulesPlan(julesApiKey, taskId, false);
      setJulesMessages((prev) =>
        prev.map((m) => {
          if (m.julesActivity && m.julesActivity.taskId === taskId) {
            return {
              ...m,
              text: "Plan rejected by user.",
              julesActivity: {
                ...m.julesActivity,
                status: "failed",
                errorMessage: "Plan was rejected by user.",
              },
            };
          }
          return m;
        })
      );
    } catch (err: unknown) {
      console.error("Failed to reject plan:", err);
    }
  };

  // Dedicated resilient streaming hook
  const {
    isGenerating,
    error: streamError,
    errorDetails,
    startStream,
    stopStream,
    clearError,
  } = useGeminiStream({
    customApiKey,
    onError: (err) => {
      if (err.isKeyInvalid || err.isAuthError || err.isRevoked) {
        if (activeProject) {
          updateStoredProject(activeProject.id, {
            isValid: false,
            status: "invalid_key",
            statusMessage: "Key expired or revoked",
          });
          setActiveProject((prev) =>
            prev
              ? {
                  ...prev,
                  isValid: false,
                  status: "invalid_key",
                  statusMessage: "Key expired or revoked",
                }
              : null
          );
          setProjects(loadStoredProjects());
        }
      }
    },
  });

  // Online / offline network detection
  const { isOnline } = useNetworkStatus();

  // Screen and window security (FLAG_SECURE)
  const { isShieldActive } = useWindowSecurity({
    isSensitiveScreenActive: showSettingsModal || showImportModal,
  });

  // Debounced auto-save draft to protect against Android tab suspension (LMK)
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

  // Continuous debounced auto-archiving of active conversation into history
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

  // Ensure persistent storage has zero mock data on application boot
  useEffect(() => {
    purgeMockSessionsFromStorage();
  }, []);

  // Initialize & fetch server health / models
  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data: { hasServerApiKey?: boolean }) => {
        if (data.hasServerApiKey) {
          setHasServerKey(true);
        }
      })
      .catch(() => {});

    // Check server session for current Google user
    fetchServerCurrentUser().then((user: GoogleUser | null) => {
      if (user) {
        setGoogleUser(user);
      }
    });

    const storedKey = loadStoredApiKey();
    const modelHeaders: Record<string, string> = {};
    if (storedKey) {
      modelHeaders["x-gemini-api-key"] = storedKey;
    }

    fetch("/api/models", { headers: modelHeaders })
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data: { models?: ModelInfo[] } | null) => {
        if (data?.models && Array.isArray(data.models) && data.models.length > 0) {
          const cleaned = data.models.filter((m) => !isDeprecatedOrUnusableModel(m.id));
          if (cleaned.length > 0) {
            setModels(cleaned);
          }
        }
      })
      .catch(() => {});

    if (window.innerWidth >= 1024) {
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

  const handleGoogleLogin = async (email?: string, name?: string) => {
    const user = await initiateGoogleLogin(email, name);
    if (user) {
      setGoogleUser(user);
      // Re-fetch live models with the authenticated Google credentials
      const modelHeaders: Record<string, string> = {};
      const key = customApiKey || loadStoredApiKey();
      if (key) modelHeaders["x-gemini-api-key"] = key;

      fetch("/api/models?refresh=true", { headers: modelHeaders })
        .then((res) => {
          if (!res.ok) return null;
          return res.json();
        })
        .then((data: { models?: ModelInfo[] } | null) => {
          if (data?.models && Array.isArray(data.models) && data.models.length > 0) {
            const cleaned = data.models.filter((m) => !isDeprecatedOrUnusableModel(m.id));
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
      fetch("/api/models?refresh=true", {
        headers: { "x-gemini-api-key": key.trim() },
      })
        .then((res) => {
          if (!res.ok) return null;
          return res.json();
        })
        .then((data: { models?: ModelInfo[] } | null) => {
          if (data?.models && Array.isArray(data.models) && data.models.length > 0) {
            setModels(data.models);
          }
        })
        .catch(() => {});
    }
  };

  // Phase 3: Project switching, scope isolation & lifecycle wiring
  const handleProjectActivated = (project: ProjectInfo) => {
    // 1. Cancel any active stream to prevent state pollution
    if (isGenerating) {
      stopStream();
    }

    // 2. Persist current draft under outgoing active project
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

    // 3. Mark new project active in storage & local state
    setActiveProjectId(project.id);
    setActiveProject(project);
    setCustomApiKey(project.apiKey);
    saveStoredApiKey(project.apiKey);

    // 4. Load incoming project's scoped draft state
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

    // 5. Synchronize project list & clear transient toasts
    setProjects(loadStoredProjects());
    setCandidateClipboardKey("");
    setClipboardToastKey(null);
    setCurrentSessionId(`sess_${Date.now()}`);
  };

  const handleStartNewChat = () => {
    if (isGenerating) {
      stopStream();
    }
    const newSessionId = `sess_${Date.now()}`;
    setCurrentSessionId(newSessionId);
    setMessages([]);
  };

  const handleSelectChatSession = (session: ChatSession) => {
    if (isGenerating) {
      stopStream();
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

  const handleDeleteProject = (id: string) => {
    deleteStoredProject(id);
    const updated = loadStoredProjects();
    setProjects(updated);
    if (activeProject?.id === id) {
      if (updated.length > 0) {
        handleProjectActivated(updated[0]);
      } else {
        setActiveProject(null);
        setCustomApiKey("");
        saveStoredApiKey("");
        // Clean wipe to starter state
        setMessages([]);
      }
    }
  };

  // Phase 2: Background resume clipboard inspection and sniffing
  useClipboardKeySniffer({
    activeApiKey: customApiKey,
    onKeyDetected: (detectedKey) => {
      setCandidateClipboardKey(detectedKey);
      setClipboardToastKey(detectedKey);
    },
  });

  const refreshServerAuth = async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/health");
      const data = (await res.json()) as { hasServerApiKey?: boolean };
      const hasKey = Boolean(data.hasServerApiKey);
      setHasServerKey(hasKey);
      return hasKey;
    } catch {
      return false;
    }
  };

  // Chat: Send Message
  const handleSendMessage = async (
    text: string,
    attachments?: MessageAttachment[],
    templateIds?: string[],
    rawUserText?: string
  ) => {
    if (isGenerating || !isOnline) return;
    if (!hasApiKey) {
      handleOpenSettings("account");
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text,
      images: attachments,
      timestamp: Date.now(),
      templateIds,
      rawUserText,
    };

    const updatedMessages = [...messages, userMessage];

    // Placeholder model message for streaming
    const modelMessageId = `model-${Date.now()}`;
    const placeholderModelMsg: ChatMessage = {
      id: modelMessageId,
      role: "model",
      text: "",
      timestamp: Date.now(),
      isStreaming: true,
    };
    setMessages([...updatedMessages, placeholderModelMsg]);

    // Build payload messages
    const apiMessages: IncomingMessage[] = updatedMessages.map((m) => ({
      role: m.role,
      text: m.text,
      images: m.images?.map((img) => ({
        mimeType: img.mimeType,
        data: img.data,
      })),
    }));

    const result = await startStream(
      {
        model: config.model,
        messages: apiMessages,
        systemInstruction: config.systemInstruction,
        temperature: config.temperature,
        topP: config.topP,
        topK: config.topK,
        maxOutputTokens: config.maxOutputTokens,
        responseMimeType: config.responseMimeType,
      },
      (accumulatedText) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === modelMessageId ? { ...m, text: accumulatedText, isStreaming: true } : m
          )
        );
      }
    );

    if (result) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === modelMessageId
            ? {
                ...m,
                text: result.text,
                isStreaming: false,
                durationMs: result.durationMs,
                tokenCount: result.totalTokens,
              }
            : m
        )
      );
    } else {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === modelMessageId
            ? {
                ...m,
                isStreaming: false,
                error: streamError || "Failed to generate response. Check API key.",
              }
            : m
        )
      );
    }
  };

  // Regenerate last response
  const handleRegenerate = () => {
    if (messages.length === 0 || isGenerating || !isOnline) return;
    const lastUserIdx = messages.map((m) => m.role).lastIndexOf("user");
    if (lastUserIdx === -1) return;

    const trimmed = messages.slice(0, lastUserIdx + 1);
    const lastUser = trimmed[trimmed.length - 1];
    setMessages(trimmed.slice(0, -1));
    void handleSendMessage(lastUser.text, lastUser.images);
  };

  // Load a prompt template or saved item
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

  // Save current prompt
  const handleSaveCurrentPrompt = (title: string) => {
    const newSaved: SavedPrompt = {
      id: `saved-${Date.now()}`,
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

  // Delete saved prompt
  const handleDeleteSavedPrompt = (id: string) => {
    const updated = savedPrompts.filter((p) => p.id !== id);
    setSavedPrompts(updated);
    persistSavedPrompts(updated);
  };

  const totalTokensEstimate = (() => {
    const sysTokens = Math.round((config.systemInstruction?.length || 0) / 4);
    if (promptType === "chat" || promptType === "jules") {
      const msgTokens = messages.reduce((acc, m) => {
        return acc + (m.tokenCount || Math.round((m.text?.length || 0) / 4));
      }, 0);
      return msgTokens + sysTokens;
    }
    return sysTokens;
  })();

  const currentModelObj = models.find((m) => m.id === config.model);
  const currentModelName = currentModelObj ? currentModelObj.name : config.model;

  return (
    <AndroidFrame mode={deviceMode}>
      {/* FLAG_SECURE Privacy Shield to obscure sensitive snapshots in App Switcher */}
      <SecurePrivacyShield isActive={isShieldActive} />

      {/* Top Application Bar */}
      <TopAppBar
        promptType={promptType}
        onSelectPromptType={(type) => {
          setPromptType(type);
        }}
        currentModelName={
          promptType === "jules"
            ? "Google Jules Agent"
            : currentModelName
        }
        onOpenParameters={() => setShowTunerSheet(true)}
        onOpenSettings={handleOpenSettings}
        onOpenBottomNav={() => setShowBottomNav(true)}
        hasApiKey={promptType === "jules" ? Boolean(julesApiKey.trim()) : hasApiKey}
        googleUser={googleUser}
        totalTokens={totalTokensEstimate}
        maxTokens={1_000_000}
        systemInstruction={config.systemInstruction}
        onUpdateSystemInstruction={(inst) =>
          setConfig((prev) => ({ ...prev, systemInstruction: inst }))
        }
        onOpenCustomTabBrowser={() => {
          setBrowserService(promptType === "jules" ? "jules" : "aistudio");
          setShowCustomTabBrowser(true);
        }}
        onOpenImportProject={() => {
          setCandidateClipboardKey("");
          setShowImportModal(true);
        }}
        activeProjectName={activeProject?.name}
        activeProject={activeProject}
        projects={projects}
        onSelectProject={handleProjectActivated}
        activeJulesSession={activeJulesSession}
        onOpenJulesSessions={() => setShowJulesDrawer(true)}
        onOpenPromptTemplates={() => {
          if (promptType !== "chat" && promptType !== "jules") {
            setPromptType("chat");
          }
          setIsTemplateDrawerOpen(true);
        }}
        selectedTemplateCount={selectedTemplateIds.length}
      />

      {/* Floating Clipboard Key Sniffer Detection Alert */}
      {clipboardToastKey && !showImportModal && !showCustomTabBrowser && (
        <div
          id="clipboard-key-detection-banner"
          className="mx-3 my-2 p-3 rounded-xl bg-gradient-to-r from-blue-950/90 to-indigo-950/90 border border-blue-500/40 text-blue-200 flex items-center justify-between gap-2.5 shadow-lg animate-in slide-in-from-top-2 shrink-0"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Key className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-white">Google API Key Copied</span>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-mono">
                  {maskApiKey(clipboardToastKey)}
                </span>
              </div>
              <p className="text-[11px] text-zinc-300 truncate">
                Tap to import and activate in this project
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              id="dismiss-clipboard-banner-btn"
              onClick={async () => {
                setClipboardToastKey(null);
                setCandidateClipboardKey("");
                await clearClipboardSafe();
              }}
              className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
              title="Dismiss and wipe clipboard"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              id="import-detected-key-btn"
              onClick={() => {
                setCandidateClipboardKey(clipboardToastKey);
                setShowImportModal(true);
                setClipboardToastKey(null);
              }}
              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1 transition-colors shadow-sm active:scale-95"
            >
              <span>Import</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Unauthenticated Alert Banner */}
      {!hasApiKey && (
        <div className="bg-muted/90 border-b border-border px-3.5 py-2 text-xs text-foreground flex items-center justify-between gap-2 shrink-0 animate-in fade-in">
          <div className="flex items-center gap-2 overflow-hidden">
            <Shield className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate text-[11px] sm:text-xs">
              <strong>Authentication Required:</strong> Connect your AI Studio workspace or API key to start prompting.
            </span>
          </div>
          <button
            id="banner-auth-btn"
            onClick={() => handleOpenSettings("account")}
            className="px-2.5 py-1 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-[11px] shadow-sm flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
          >
            <Key className="w-3 h-3" />
            <span>Connect</span>
          </button>
        </div>
      )}

      {/* Offline Status Banner */}
      {!isOnline && (
        <div className="bg-muted border-b border-border px-3 py-2 text-xs text-muted-foreground flex items-center justify-between gap-2 shrink-0 animate-pulse">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-muted-foreground shrink-0" />
            <span>You are currently offline. Prompts will resume when network is restored.</span>
          </div>
          <span className="px-2 py-0.5 rounded bg-card text-muted-foreground border border-border font-mono text-[10px]">
            OFFLINE
          </span>
        </div>
      )}

      {/* Granular Error Banner (Quota, Auth, Revocation, Network) */}
      {streamError && (
        <div
          className={`border-b px-3 py-2 text-xs flex items-center justify-between gap-2 shrink-0 ${
            errorDetails?.isKeyInvalid || activeProject?.status === "invalid_key"
              ? "bg-muted border-border text-foreground"
              : "bg-destructive/15 border-destructive/30 text-foreground /* error */"
          }`}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {errorDetails?.isKeyInvalid || activeProject?.status === "invalid_key" ? (
              <AlertTriangle className="w-4 h-4 text-zinc-400 shrink-0 animate-pulse" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="truncate">
              {errorDetails?.isKeyInvalid || activeProject?.status === "invalid_key"
                ? "API key expired or revoked — Update API Key in AI Studio to resume requests."
                : streamError}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {errorDetails?.isKeyInvalid || activeProject?.status === "invalid_key" ? (
              <button
                type="button"
                id="banner-update-ai-studio-btn"
                onClick={() => {
                  clearError();
                  setShowCustomTabBrowser(true);
                }}
                className="px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-black font-semibold flex items-center gap-1 text-[11px] shadow-sm transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Update in AI Studio</span>
              </button>
            ) : errorDetails?.isAuthError ? (
              <button
                onClick={() => {
                  clearError();
                  handleOpenSettings("account");
                }}
                className="px-2 py-0.5 rounded bg-rose-800 hover:bg-rose-700 text-rose-100 font-medium flex items-center gap-1 text-[11px]"
              >
                <Key className="w-3 h-3" /> Fix Key
              </button>
            ) : null}
            {errorDetails?.isQuotaError && (
              <button
                onClick={() => {
                  clearError();
                  setConfig((prev) => ({ ...prev, model: "gemini-3.1-flash-lite" }));
                }}
                className="px-2 py-0.5 rounded bg-amber-800 hover:bg-amber-700 text-amber-100 font-medium flex items-center gap-1 text-[11px]"
              >
                <RefreshCw className="w-3 h-3" /> Try Lite
              </button>
            )}
            {errorDetails?.isUnavailable && (
              <button
                onClick={() => {
                  clearError();
                  handleRegenerate();
                }}
                className="px-2 py-0.5 rounded bg-amber-800 hover:bg-amber-700 text-amber-100 font-medium flex items-center gap-1 text-[11px]"
              >
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
            )}
            <button
              onClick={clearError}
              className="p-1 text-zinc-400 hover:text-white rounded transition-colors"
              title="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area: Primary Active Workspace */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {promptType === "chat" && (
          <ChatWorkspace
            messages={messages}
            onSendMessage={(text, atts, tplIds, rawText) => void handleSendMessage(text, atts, tplIds, rawText)}
            onClearMessages={handleStartNewChat}
            onRegenerate={handleRegenerate}
            onStopGeneration={stopStream}
            isGenerating={isGenerating}
            config={config}
            onUpdateSystemInstruction={(inst) =>
              setConfig((prev) => ({ ...prev, systemInstruction: inst }))
            }
            onOpenParameters={() => setShowTunerSheet(true)}
            hasApiKey={hasApiKey}
            onOpenAuth={() => handleOpenSettings("account")}
            speechSettings={speechSettings}
            onSaveSpeechSettings={(newSettings) => {
              setSpeechSettings(newSettings);
              saveSpeechSettings(newSettings);
            }}
            onOpenSettings={handleOpenSettings}
            activeProjectId={activeProject?.id}
            currentSessionId={currentSessionId}
            onSelectSession={handleSelectChatSession}
            onNewChat={handleStartNewChat}
            onOpenBottomNav={() => setShowBottomNav(true)}
            isTemplateDrawerOpen={isTemplateDrawerOpen}
            onOpenTemplateDrawer={() => setIsTemplateDrawerOpen(true)}
            onCloseTemplateDrawer={() => setIsTemplateDrawerOpen(false)}
            selectedTemplateIds={selectedTemplateIds}
            onToggleTemplate={handleToggleTemplate}
            onRemoveTemplate={handleRemoveTemplate}
            onClearAllTemplates={handleClearAllTemplates}
          />
        )}
        {promptType === "code" && (
          <MobileIDEWorkspace
            config={config}
            messages={messages}
            freeformText={freeformText}
            structuredExamples={structuredExamples}
            hasApiKey={hasApiKey}
            onOpenAuth={() => handleOpenSettings("account")}
            onSwitchToPrompt={() => {
              setPromptType("chat");
            }}
            onOpenParameters={() => setShowTunerSheet(true)}
          />
        )}
        {promptType === "jules" && (
          <ChatWorkspace
            isJulesMode={true}
            activeJulesSession={activeJulesSession}
            onOpenJulesSessions={() => setShowJulesDrawer(true)}
            onApproveJulesPlan={(taskId) => void handleApproveJulesPlan(taskId)}
            onRejectJulesPlan={(taskId) => void handleRejectJulesPlan(taskId)}
            isApprovingJulesPlan={isApprovingJulesPlan}
            messages={julesMessages}
            onSendMessage={(text, attachments, templateIds, rawUserText) =>
              void handleSendJulesMessage(text, attachments, templateIds, rawUserText)
            }
            onClearMessages={handleClearJulesMessages}
            onRegenerate={() => {}}
            onStopGeneration={handleStopJulesPolling}
            isGenerating={isJulesExecuting}
            config={config}
            onUpdateSystemInstruction={(inst) =>
              setConfig((prev) => ({ ...prev, systemInstruction: inst }))
            }
            onOpenParameters={() => setShowTunerSheet(true)}
            hasApiKey={Boolean(julesApiKey.trim())}
            onOpenAuth={() => handleOpenSettings("account")}
            speechSettings={speechSettings}
            onSaveSpeechSettings={(newSettings) => {
              setSpeechSettings(newSettings);
              saveSpeechSettings(newSettings);
            }}
            onOpenSettings={handleOpenSettings}
            activeProjectId={activeProject?.id}
            currentSessionId={activeJulesSession?.id}
            onSelectSession={(sess) => {
              const jSession = julesSessions.find((s) => s.id === sess.id);
              if (jSession) {
                setActiveJulesSessionId(jSession.id);
                setActiveJulesSession(jSession);
                setJulesMessages(jSession.messages || []);
              }
            }}
            onNewChat={() => setShowJulesDrawer(true)}
            onOpenBottomNav={() => setShowBottomNav(true)}
            isTemplateDrawerOpen={isTemplateDrawerOpen}
            onOpenTemplateDrawer={() => setIsTemplateDrawerOpen(true)}
            onCloseTemplateDrawer={() => setIsTemplateDrawerOpen(false)}
            selectedTemplateIds={selectedTemplateIds}
            onToggleTemplate={handleToggleTemplate}
            onRemoveTemplate={handleRemoveTemplate}
            onClearAllTemplates={handleClearAllTemplates}
          />
        )}
        {promptType === "stubs" && (
          <StubsWorkspace
            onOpenBottomNav={() => setShowBottomNav(true)}
            onOpenParameters={() => setShowTunerSheet(true)}
          />
        )}
      </main>

      {/* Primary Android Workspace Bottom Navigation Bar */}
      <BottomNavBar
        activeWorkspace={promptType}
        onSelectWorkspace={(ws) => {
          setPromptType(ws);
          setShowBottomNav(false);
        }}
        isOpen={showBottomNav}
        onClose={() => setShowBottomNav(false)}
      />

      {/* Canonical Model & Tuner Bottom Sheet */}
      <TunerBottomSheet
        isOpen={showTunerSheet}
        config={config}
        onChangeConfig={setConfig}
        models={models}
        onClose={() => setShowTunerSheet(false)}
        isModal={true}
        hasApiKey={hasApiKey}
        onOpenAuth={() => handleOpenSettings("account")}
      />

      {/* Unified Settings Modal Hub */}
      <UnifiedSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        initialTab={settingsTab}
        customApiKey={customApiKey}
        onSaveCustomApiKey={handleSaveApiKey}
        hasServerKey={hasServerKey}
        onRefreshServerAuth={refreshServerAuth}
        googleUser={googleUser}
        onGoogleLogin={handleGoogleLogin}
        onGoogleLogout={handleGoogleLogout}
        speechSettings={speechSettings}
        onSaveSpeechSettings={(newSettings) => {
          setSpeechSettings(newSettings);
          saveSpeechSettings(newSettings);
        }}
        config={config}
        onChangeConfig={setConfig}
        models={models}
        savedPrompts={savedPrompts}
        onLoadPrompt={(p) => {
          handleLoadPrompt(p);
          setShowSettingsModal(false);
        }}
        onSaveCurrentPrompt={handleSaveCurrentPrompt}
        onDeletePrompt={handleDeleteSavedPrompt}
        messages={messages}
        deviceMode={deviceMode}
        onSelectDeviceMode={setDeviceMode}
        onOpenCustomTabBrowser={() => setShowCustomTabBrowser(true)}
        onOpenImportProject={() => {
          setCandidateClipboardKey("");
          setShowImportModal(true);
        }}
        activeProjectName={activeProject?.name}
        projects={projects}
        activeProject={activeProject}
        onSelectProject={handleProjectActivated}
        onRenameProject={handleRenameProject}
        onDeleteProject={handleDeleteProject}
      />

      {/* Phase 2: In-App AI Studio Launcher & Jules Settings (Chrome Custom Tab style) */}
      <CustomTabBrowserModal
        isOpen={showCustomTabBrowser}
        onClose={() => setShowCustomTabBrowser(false)}
        initialService={browserService}
        activeApiKey={browserService === "jules" ? julesApiKey : customApiKey}
        onImportKey={(key, service) => {
          if (service === "jules") {
            handleSaveJulesApiKey(key);
            setShowCustomTabBrowser(false);
          } else {
            setCandidateClipboardKey(key);
            setShowImportModal(true);
            setShowCustomTabBrowser(false);
          }
        }}
      />

      {/* Google Jules Autonomous Agent Task & Session Management Drawer */}
      <JulesSessionDrawer
        isOpen={showJulesDrawer}
        onClose={() => setShowJulesDrawer(false)}
        activeSessionId={activeJulesSession?.id || null}
        onSelectSession={(session) => {
          setActiveJulesSessionId(session.id);
          setActiveJulesSession(session);
          setJulesMessages(session.messages || []);
          setShowJulesDrawer(false);
        }}
        onOpenApiKeyModal={() => {
          handleOpenSettings("account");
        }}
      />

      {/* Phase 2: Import Project Modal / Bottom Sheet */}
      <ImportProjectSheet
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setCandidateClipboardKey("");
        }}
        initialKey={candidateClipboardKey}
        onSuccess={handleProjectActivated}
        availableModels={models.map((m) => ({ id: m.id, name: m.name }))}
      />

      {/* Progressive Web App Network & Offline Mode Banner Indicator */}
      <OfflineIndicator />
    </AndroidFrame>
  );
}
