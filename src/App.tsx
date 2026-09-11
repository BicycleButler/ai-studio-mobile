import React, { useState, useEffect } from "react";
import {
  PromptType,
  ActiveTab,
  DeviceFrameMode,
  PromptConfig,
  ChatMessage,
  StructuredExample,
  SavedPrompt,
  ModelInfo,
  MessageAttachment,
  IncomingMessage,
} from "./types";
import { STARTER_TEMPLATES } from "./data/templates";
import { TopAppBar } from "./components/TopAppBar";
import { ChatWorkspace } from "./components/ChatWorkspace";
import { FreeformWorkspace } from "./components/FreeformWorkspace";
import { StructuredWorkspace } from "./components/StructuredWorkspace";
import { TunerBottomSheet } from "./components/TunerBottomSheet";
import { CodeExportModal } from "./components/CodeExportModal";
import { LibraryModal } from "./components/LibraryModal";
import { DesktopWrapperGuide } from "./components/DesktopWrapperGuide";
import { ApiKeyModal } from "./components/ApiKeyModal";
import { UnifiedSettingsModal, SettingsTab } from "./components/UnifiedSettingsModal";
import { AndroidFrame } from "./components/AndroidFrame";
import { useGeminiStream } from "./hooks/useGeminiStream";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import {
  loadStoredApiKey,
  saveStoredApiKey,
  loadSavedPrompts,
  persistSavedPrompts,
  loadDraftState,
  saveDraftState,
} from "./utils/storage";
import {
  SpeechSettings,
  loadSpeechSettings,
  saveSpeechSettings,
} from "./services/speechVoices";
import { AlertCircle, Key, RefreshCw, WifiOff, X, Shield } from "lucide-react";

export default function App() {
  // Load draft state for crash/reload recovery
  const initialDraft = loadDraftState();

  // Navigation & Mode states
  const [promptType, setPromptType] = useState<PromptType>(initialDraft.promptType);
  const [activeTab, setActiveTab] = useState<ActiveTab>("chat");
  const [deviceMode, setDeviceMode] = useState<DeviceFrameMode>("responsive");
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("tune");
  const [speechSettings, setSpeechSettings] = useState<SpeechSettings>(() =>
    loadSpeechSettings()
  );

  const handleOpenSettings = (tab: SettingsTab = "tune") => {
    setSettingsTab(tab);
    setShowSettingsModal(true);
  };

  // Models & Server Key state
  const [models, setModels] = useState<ModelInfo[]>([
    {
      id: "gemini-3.8-flash",
      name: "Gemini 3.8 Flash",
      category: "Recommended",
      badge: "Fast & Multimodal",
      description: "Google's latest versatile model for general text, multimodal reasoning, and coding.",
      contextWindow: "1M tokens",
      supportsVision: true,
      supportsAudio: true,
      supportsSystemInstruction: true,
      supportsJson: true,
    },
    {
      id: "gemini-3.1-flash-lite",
      name: "Gemini 3.1 Flash Lite",
      category: "High Speed",
      badge: "Ultra Low Latency",
      description: "Lightweight and optimized for swift, cost-effective mobile responses and turnarounds.",
      contextWindow: "1M tokens",
      supportsVision: true,
      supportsAudio: false,
      supportsSystemInstruction: true,
      supportsJson: true,
    },
    {
      id: "gemini-flash-latest",
      name: "Gemini Flash (Latest)",
      category: "Latest Stable",
      badge: "Stable",
      description: "Always targets the latest recommended stable Gemini Flash release.",
      contextWindow: "1M tokens",
      supportsVision: true,
      supportsAudio: true,
      supportsSystemInstruction: true,
      supportsJson: true,
    },
    {
      id: "gemini-2.5-flash",
      name: "Gemini 2.5 Flash",
      category: "Legacy Fast",
      badge: "2.5 Generation",
      description: "Previous generation high-speed multimodal model.",
      contextWindow: "1M tokens",
      supportsVision: true,
      supportsAudio: true,
      supportsSystemInstruction: true,
      supportsJson: true,
    },
  ]);
  const [hasServerKey, setHasServerKey] = useState(false);
  const [customApiKey, setCustomApiKey] = useState<string>(() => loadStoredApiKey());
  const hasApiKey = Boolean(customApiKey.trim() || hasServerKey);

  // Prompt Configuration state
  const [config, setConfig] = useState<PromptConfig>(initialDraft.config);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    return STARTER_TEMPLATES[0].messages;
  });

  // Freeform state
  const [freeformText, setFreeformText] = useState(initialDraft.freeformText);
  const [freeformOutput, setFreeformOutput] = useState("");
  const [freeformTokens, setFreeformTokens] = useState<number | undefined>();
  const [freeformDurationMs, setFreeformDurationMs] = useState<number | undefined>();

  // Structured state
  const [structuredExamples, setStructuredExamples] = useState<StructuredExample[]>(
    initialDraft.structuredExamples
  );
  const [structuredOutput, setStructuredOutput] = useState("");

  // Library / saved prompts
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>(() => loadSavedPrompts());

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
  });

  // Online / offline network detection
  const { isOnline } = useNetworkStatus();

  // Debounced auto-save draft to protect against Android tab suspension (LMK)
  useEffect(() => {
    const timeout = setTimeout(() => {
      saveDraftState({
        promptType,
        config,
        freeformText,
        structuredExamples,
      });
    }, 500);
    return () => clearTimeout(timeout);
  }, [promptType, config, freeformText, structuredExamples]);

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

    fetch("/api/models")
      .then((res) => res.json())
      .then((data: { models?: ModelInfo[] }) => {
        if (data.models && Array.isArray(data.models) && data.models.length > 0) {
          setModels(data.models);
        }
      })
      .catch(() => {});

    if (window.innerWidth >= 1024) {
      setDeviceMode("pixel");
    }
  }, []);

  const handleSaveApiKey = (key: string) => {
    setCustomApiKey(key);
    saveStoredApiKey(key);
  };

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
  const handleSendMessage = async (text: string, attachments?: MessageAttachment[]) => {
    if (isGenerating || !isOnline) return;
    if (!hasApiKey) {
      setShowApiKeyModal(true);
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text,
      images: attachments,
      timestamp: Date.now(),
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

  // Freeform: Run prompt
  const handleExecuteFreeform = async (promptContent: string) => {
    if (isGenerating || !isOnline) return;
    if (!hasApiKey) {
      setShowApiKeyModal(true);
      return;
    }
    setFreeformOutput("");
    setFreeformTokens(undefined);
    setFreeformDurationMs(undefined);

    const result = await startStream(
      {
        model: config.model,
        messages: [{ role: "user", text: promptContent }],
        systemInstruction: config.systemInstruction,
        temperature: config.temperature,
        topP: config.topP,
        topK: config.topK,
        maxOutputTokens: config.maxOutputTokens,
      },
      (accumulatedText) => {
        setFreeformOutput(accumulatedText);
      }
    );

    if (result) {
      setFreeformOutput(result.text);
      setFreeformDurationMs(result.durationMs);
      setFreeformTokens(result.totalTokens);
    } else if (streamError) {
      setFreeformOutput(`Error: ${streamError}`);
    }
  };

  // Structured: Run prompt
  const handleExecuteStructured = async (
    testInput: string,
    examples: StructuredExample[]
  ) => {
    if (isGenerating || !isOnline) return;
    if (!hasApiKey) {
      setShowApiKeyModal(true);
      return;
    }
    setStructuredOutput("");

    const fewShotMessages: IncomingMessage[] = [];
    examples.forEach((ex) => {
      if (ex.input) fewShotMessages.push({ role: "user", text: ex.input });
      if (ex.output) fewShotMessages.push({ role: "model", text: ex.output });
    });
    fewShotMessages.push({ role: "user", text: testInput });

    const result = await startStream(
      {
        model: config.model,
        messages: fewShotMessages,
        systemInstruction: config.systemInstruction,
        temperature: config.temperature,
        topP: config.topP,
        topK: config.topK,
        maxOutputTokens: config.maxOutputTokens,
        responseMimeType: config.responseMimeType,
      },
      (accumulatedText) => {
        setStructuredOutput(accumulatedText);
      }
    );

    if (result) {
      setStructuredOutput(result.text);
    } else if (streamError) {
      setStructuredOutput(`Error: ${streamError}`);
    }
  };

  // Load a prompt template or saved item
  const handleLoadPrompt = (prompt: SavedPrompt) => {
    setPromptType(prompt.type);
    setConfig(prompt.config);
    if (prompt.messages && prompt.messages.length > 0) {
      setMessages(prompt.messages);
    }
    if (prompt.freeformText) {
      setFreeformText(prompt.freeformText);
    }
    if (prompt.structuredExamples) {
      setStructuredExamples(prompt.structuredExamples);
    }
    setActiveTab("chat");
  };

  // Save current prompt
  const handleSaveCurrentPrompt = (title: string) => {
    const newSaved: SavedPrompt = {
      id: `saved-${Date.now()}`,
      title,
      type: promptType,
      config: { ...config },
      messages: [...messages],
      freeformText,
      structuredExamples: [...structuredExamples],
      updatedAt: Date.now(),
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
    if (promptType === "chat") {
      const msgTokens = messages.reduce((acc, m) => {
        return acc + (m.tokenCount || Math.round((m.text?.length || 0) / 4));
      }, 0);
      return msgTokens + sysTokens;
    }
    if (promptType === "freeform") {
      const inTokens = Math.round((freeformText?.length || 0) / 4);
      const outTokens = Math.round((freeformOutput?.length || 0) / 4);
      return inTokens + outTokens + sysTokens;
    }
    if (promptType === "structured") {
      const examplesTokens = structuredExamples.reduce((acc, ex) => {
        return (
          acc +
          Math.round((ex.input?.length || 0) / 4) +
          Math.round((ex.output?.length || 0) / 4)
        );
      }, 0);
      const outTokens = Math.round((structuredOutput?.length || 0) / 4);
      return examplesTokens + outTokens + sysTokens;
    }
    return sysTokens;
  })();

  const currentModelObj = models.find((m) => m.id === config.model);
  const currentModelName = currentModelObj ? currentModelObj.name : config.model;

  return (
    <AndroidFrame mode={deviceMode}>
      {/* Top Application Bar */}
      <TopAppBar
        promptType={promptType}
        onSelectPromptType={(type) => {
          setPromptType(type);
          setActiveTab("chat");
        }}
        currentModelName={currentModelName}
        onOpenParameters={() => handleOpenSettings("tune")}
        onOpenSettings={handleOpenSettings}
        hasApiKey={hasApiKey}
        totalTokens={totalTokensEstimate}
        maxTokens={1_000_000}
        systemInstruction={config.systemInstruction}
        onUpdateSystemInstruction={(inst) =>
          setConfig((prev) => ({ ...prev, systemInstruction: inst }))
        }
      />

      {/* Unauthenticated Alert Banner */}
      {!hasApiKey && (
        <div className="bg-gradient-to-r from-blue-950/90 via-[#181b24] to-indigo-950/90 border-b border-blue-500/30 px-3.5 py-2 text-xs text-blue-200 flex items-center justify-between gap-2 shrink-0 animate-in fade-in">
          <div className="flex items-center gap-2 overflow-hidden">
            <Shield className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="truncate text-[11px] sm:text-xs">
              <strong>Authentication Required:</strong> Connect your AI Studio workspace or API key to start prompting.
            </span>
          </div>
          <button
            id="banner-auth-btn"
            onClick={() => handleOpenSettings("auth")}
            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[11px] shadow-sm flex items-center gap-1 shrink-0 transition-colors"
          >
            <Key className="w-3 h-3" />
            <span>Connect</span>
          </button>
        </div>
      )}

      {/* Offline Status Banner */}
      {!isOnline && (
        <div className="bg-amber-950/90 border-b border-amber-800/80 px-3 py-2 text-xs text-amber-200 flex items-center justify-between gap-2 shrink-0 animate-pulse">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
            <span>You are currently offline. Prompts will resume when network is restored.</span>
          </div>
          <span className="px-2 py-0.5 rounded bg-amber-900/60 text-amber-300 font-mono text-[10px]">
            OFFLINE
          </span>
        </div>
      )}

      {/* Granular Error Banner (Quota, Auth, Network) */}
      {streamError && (
        <div className="bg-rose-950/80 border-b border-rose-800/60 px-3 py-2 text-xs text-rose-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 overflow-hidden">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="truncate">{streamError}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {errorDetails?.isAuthError && (
              <button
                onClick={() => {
                  clearError();
                  handleOpenSettings("auth");
                }}
                className="px-2 py-0.5 rounded bg-rose-800 hover:bg-rose-700 text-rose-100 font-medium flex items-center gap-1 text-[11px]"
              >
                <Key className="w-3 h-3" /> Fix Key
              </button>
            )}
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
            <button
              onClick={clearError}
              className="p-1 text-rose-400 hover:text-rose-200"
              title="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area based on activeTab */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {activeTab === "chat" && (
          <>
            {promptType === "chat" && (
              <ChatWorkspace
                messages={messages}
                onSendMessage={(text, atts) => void handleSendMessage(text, atts)}
                onClearMessages={() => setMessages([])}
                onRegenerate={handleRegenerate}
                onStopGeneration={stopStream}
                isGenerating={isGenerating}
                config={config}
                onUpdateSystemInstruction={(inst) =>
                  setConfig((prev) => ({ ...prev, systemInstruction: inst }))
                }
                onOpenParameters={() => handleOpenSettings("tune")}
                hasApiKey={hasApiKey}
                onOpenAuth={() => handleOpenSettings("auth")}
                speechSettings={speechSettings}
                onSaveSpeechSettings={(newSettings) => {
                  setSpeechSettings(newSettings);
                  saveSpeechSettings(newSettings);
                }}
                onOpenSettings={handleOpenSettings}
              />
            )}
            {promptType === "freeform" && (
              <FreeformWorkspace
                config={config}
                freeformText={freeformText}
                onChangeText={setFreeformText}
                onExecute={(content) => void handleExecuteFreeform(content)}
                onStop={stopStream}
                isGenerating={isGenerating}
                output={freeformOutput}
                tokens={freeformTokens}
                durationMs={freeformDurationMs}
              />
            )}
            {promptType === "structured" && (
              <StructuredWorkspace
                config={config}
                examples={structuredExamples}
                onUpdateExamples={setStructuredExamples}
                onExecute={(input, exs) => void handleExecuteStructured(input, exs)}
                onStop={stopStream}
                isGenerating={isGenerating}
                output={structuredOutput}
              />
            )}
          </>
        )}

        {activeTab === "parameters" && (
          <TunerBottomSheet
            config={config}
            onChangeConfig={setConfig}
            models={models}
            onClose={() => setActiveTab("chat")}
            isModal={false}
            hasApiKey={hasApiKey}
            onOpenAuth={() => handleOpenSettings("auth")}
          />
        )}

        {activeTab === "library" && (
          <LibraryModal
            savedPrompts={savedPrompts}
            onLoadPrompt={handleLoadPrompt}
            onSaveCurrentPrompt={handleSaveCurrentPrompt}
            onDeletePrompt={handleDeleteSavedPrompt}
          />
        )}

        {activeTab === "export" && (
          <CodeExportModal config={config} messages={messages} />
        )}

        {activeTab === "companion" && (
          <DesktopWrapperGuide
            onOpenApiKeyModal={() => handleOpenSettings("auth")}
          />
        )}
      </main>

      {/* Unified Settings Modal with Tabs (Tune, Library, Get Code, Companion, Audio, Auth, Display) */}
      <UnifiedSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        initialTab={settingsTab}
        customApiKey={customApiKey}
        onSaveCustomApiKey={handleSaveApiKey}
        hasServerKey={hasServerKey}
        onRefreshServerAuth={refreshServerAuth}
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
          setActiveTab("chat");
        }}
        onSaveCurrentPrompt={handleSaveCurrentPrompt}
        onDeletePrompt={handleDeleteSavedPrompt}
        messages={messages}
        deviceMode={deviceMode}
        onSelectDeviceMode={setDeviceMode}
      />

      {/* Legacy API Key Modal fallback if needed */}
      {showApiKeyModal && (
        <ApiKeyModal
          customApiKey={customApiKey}
          onSaveCustomApiKey={handleSaveApiKey}
          hasServerKey={hasServerKey}
          onRefreshServerAuth={refreshServerAuth}
          onClose={() => setShowApiKeyModal(false)}
        />
      )}
    </AndroidFrame>
  );
}
