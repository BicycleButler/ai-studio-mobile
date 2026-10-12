import React from "react";
import {
  ChatMessage,
  MessageAttachment,
  IncomingMessage,
} from "./types";
import { TopAppBar } from "./components/TopAppBar";
import { ChatWorkspace } from "./components/ChatWorkspace";
import { MobileIDEWorkspace } from "./components/MobileIDEWorkspace";
import { StubsWorkspace } from "./components/StubsWorkspace";
import { TunerBottomSheet } from "./components/TunerBottomSheet";
import { UnifiedSettingsModal } from "./components/UnifiedSettingsModal";
import { AndroidFrame } from "./components/AndroidFrame";
import { BottomNavBar } from "./components/BottomNavBar";
import { CustomTabBrowserModal } from "./components/CustomTabBrowserModal";
import { ImportProjectSheet } from "./components/ImportProjectSheet";
import { SecurePrivacyShield } from "./components/SecurePrivacyShield";
import { JulesSessionDrawer } from "./components/JulesSessionDrawer";
import { useGeminiStream } from "./hooks/useGeminiStream";
import { useJules } from "./hooks/useJules";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { useClipboardKeySniffer } from "./hooks/useClipboardKeySniffer";
import { useWindowSecurity } from "./hooks/useWindowSecurity";
import { maskApiKey, clearClipboardSafe } from "./services/keyVerification";
import {
  updateStoredProject,
} from "./utils/storage";
import { saveSpeechSettings } from "./services/speechVoices";
import { AlertCircle, AlertTriangle, Key, RefreshCw, WifiOff, X, Shield, ArrowRight, ExternalLink } from "lucide-react";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { useAppState } from "./hooks/useAppState";

export default function App() {
  const {
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
    models,
    googleUser,
    hasServerKey,
    customApiKey,
    hasApiKey,
    config,
    setConfig,
    currentSessionId,
    messages,
    setMessages,
    freeformText,
    structuredExamples,
    savedPrompts,
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
    refreshServerAuth,
    handleLoadPrompt,
    handleSaveCurrentPrompt,
    handleDeleteSavedPrompt
  } = useAppState();

  const {
    julesApiKey,
    handleSaveJulesApiKey,
    activeJulesSession,
    julesMessages,
    isJulesExecuting,
    isApprovingJulesPlan,
    handleSendJulesMessage,
    handleClearJulesMessages,
    handleStopJulesPolling,
    handleApproveJulesPlan,
    handleRejectJulesPlan,
    handleSelectSession: handleSelectJulesSession
  } = useJules();

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
          setProjects(projects.map(p => p.id === activeProject.id ? { ...p, isValid: false, status: "invalid_key", statusMessage: "Key expired or revoked" } : p));
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

  // Phase 2: Background resume clipboard inspection and sniffing
  useClipboardKeySniffer({
    activeApiKey: customApiKey,
    onKeyDetected: (detectedKey) => {
      setCandidateClipboardKey(detectedKey);
      setClipboardToastKey(detectedKey);
    },
  });

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
      <OfflineIndicator />

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
        onSelectProject={(p) => handleProjectActivated(p, stopStream)}
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
            onClearMessages={() => handleStartNewChat(stopStream)}
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
            onSelectSession={(s) => handleSelectChatSession(s, stopStream)}
            onNewChat={() => handleStartNewChat(stopStream)}
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
            onSendMessage={async (text, attachments, templateIds, rawUserText) => {
              if (!julesApiKey.trim()) {
                 handleOpenSettings("account");
                 return;
              }
              const result = await handleSendJulesMessage(text, attachments, templateIds, rawUserText);
              if (result === false) {
                 setShowJulesDrawer(true);
              }
            }}
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
            onSelectSession={handleSelectJulesSession}
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
        onSelectProject={(p) => handleProjectActivated(p, stopStream)}
        onRenameProject={handleRenameProject}
        onDeleteProject={(id) => handleDeleteProject(id, stopStream)}
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
          handleSelectJulesSession(session);
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
        onSuccess={(p) => handleProjectActivated(p, stopStream)}
        availableModels={models.map((m) => ({ id: m.id, name: m.name }))}
      />

    </AndroidFrame>
  );
}
