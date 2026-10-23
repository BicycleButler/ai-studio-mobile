import React from "react";
import {
  ChatMessage,
  MessageAttachment,
  IncomingMessage,
} from "./types";
import { TopAppBar } from "./components/TopAppBar";
import { WorkspaceRouter } from "./components/WorkspaceRouter";
import { TunerBottomSheet } from "./components/TunerBottomSheet";
import { UnifiedSettingsModal } from "./components/UnifiedSettingsModal";
import { AndroidFrame } from "./components/AndroidFrame";
import { BottomNavBar } from "./components/BottomNavBar";
import { CustomTabBrowserModal } from "./components/CustomTabBrowserModal";
import { ImportProjectSheet } from "./components/ImportProjectSheet";
import { SecurePrivacyShield } from "./components/SecurePrivacyShield";
import { JulesSessionDrawer } from "./components/JulesSessionDrawer";
import { ClipboardKeyBanner } from "./components/ClipboardKeyBanner";
import { AuthRequiredBanner } from "./components/AuthRequiredBanner";
import { StreamErrorBanner } from "./components/StreamErrorBanner";
import { useGeminiStream } from "./hooks/useGeminiStream";
import { useJules } from "./hooks/useJules";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { useClipboardKeySniffer } from "./hooks/useClipboardKeySniffer";
import { useWindowSecurity } from "./hooks/useWindowSecurity";
import {

  projectsManager,
} from "./utils/storage";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { useAppState } from "./hooks/useAppState";
import { initializeSyncHandlers } from "./utils/syncRegistry";
import { generateUniqueId } from "./utils/idGenerator";
import { useServices } from "./services/ServiceContext";

initializeSyncHandlers();

export default function App() {
  const { keyVerificationService, speechVoicesService } = useServices();
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
    handleBulkDeleteProjects,
    refreshServerAuth,
    handleLoadPrompt,
    handleSaveCurrentPrompt,
    handleDeleteSavedPrompt,
    handleBulkDeleteSavedPrompts
  } = useAppState();

  const {
    julesApiKey,
    handleSaveJulesApiKey,
    activeJulesSession,
    julesMessages: _julesMessages,
    isJulesExecuting: _isJulesExecuting,
    isApprovingJulesPlan,
    handleSendJulesMessage,
    handleClearJulesMessages,
    handleStopJulesPolling,
    handleApproveJulesPlan,
    handleRejectJulesPlan,
    handleSelectSession: handleSelectJulesSession,
    handleBulkDeleteJulesSessions
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
          projectsManager.collection.update(activeProject.id, {
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
      id: generateUniqueId("user"),
      role: "user",
      text,
      images: attachments,
      timestamp: Date.now(),
      templateIds,
      rawUserText,
    };

    const updatedMessages = [...messages, userMessage];

    // Placeholder model message for streaming
    const modelMessageId = generateUniqueId("model");
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

      <ClipboardKeyBanner
        clipboardToastKey={clipboardToastKey}
        showImportModal={showImportModal}
        showCustomTabBrowser={showCustomTabBrowser}
        onDismiss={async () => {
          setClipboardToastKey(null);
          setCandidateClipboardKey("");
          await keyVerificationService.clearClipboardSafe();
        }}
        onImport={() => {
          setCandidateClipboardKey(clipboardToastKey || "");
          setShowImportModal(true);
          setClipboardToastKey(null);
        }}
      />

      <AuthRequiredBanner
        hasApiKey={hasApiKey}
        onOpenSettings={() => handleOpenSettings("account")}
      />

      <StreamErrorBanner
        streamError={streamError}
        errorDetails={errorDetails}
        activeProjectStatus={activeProject?.status}
        onClearError={clearError}
        onUpdateInAIStudio={() => {
          clearError();
          setShowCustomTabBrowser(true);
        }}
        onFixKey={() => {
          clearError();
          handleOpenSettings("account");
        }}
        onTryLite={() => {
          clearError();
          setConfig((prev) => ({ ...prev, model: "gemini-3.1-flash-lite" }));
        }}
        onRetry={() => {
          clearError();
          handleRegenerate();
        }}
      />

      {/* Main Content Area: Primary Active Workspace */}
      <WorkspaceRouter
        promptType={promptType}
        sharedProps={{
          config,
          onUpdateSystemInstruction: (inst) => setConfig((prev) => ({ ...prev, systemInstruction: inst })),
          onOpenParameters: () => setShowTunerSheet(true),
          hasApiKey,
          onOpenAuth: () => handleOpenSettings("account"),
          onOpenSettings: handleOpenSettings,
          activeProjectId: activeProject?.id,
          onOpenBottomNav: () => setShowBottomNav(true),
          isTemplateDrawerOpen,
          onOpenTemplateDrawer: () => setIsTemplateDrawerOpen(true),
          onCloseTemplateDrawer: () => setIsTemplateDrawerOpen(false),
          selectedTemplateIds,
          onToggleTemplate: handleToggleTemplate,
          onRemoveTemplate: handleRemoveTemplate,
          onClearAllTemplates: handleClearAllTemplates,
          speechSettings,
          onSaveSpeechSettings: (newSettings) => {
            setSpeechSettings(newSettings);
            speechVoicesService.saveSpeechSettings(newSettings);
          }
        }}
        chatProps={{
          messages,
          onSendMessage: (text, atts, tplIds, rawText) => void handleSendMessage(text, atts, tplIds, rawText),
          onClearMessages: () => handleStartNewChat(stopStream),
          onRegenerate: handleRegenerate,
          onStopGeneration: stopStream,
          isGenerating,
          currentSessionId,
          onSelectSession: (s) => handleSelectChatSession(s as import("./types").ChatSession, stopStream),
          onNewChat: () => handleStartNewChat(stopStream)
        }}
        ideProps={{
          messages,
          freeformText,
          structuredExamples,
          onSwitchToPrompt: () => { setPromptType("chat"); }
        }}
        stubsProps={{}}
        julesProps={{
          activeJulesSession,
          onOpenJulesSessions: () => setShowJulesDrawer(true),
          onApproveJulesPlan: (taskId) => void handleApproveJulesPlan(taskId),
          onRejectJulesPlan: (taskId) => void handleRejectJulesPlan(taskId),
          isApprovingJulesPlan, messages: _julesMessages, onSendMessage: (text, atts, tplIds, rawUserText) => handleSendJulesMessage(text, atts, tplIds, rawUserText),
          onClearMessages: handleClearJulesMessages,
          onStopGeneration: handleStopJulesPolling,
           isGenerating: _isJulesExecuting,
          hasJulesApiKey: Boolean(julesApiKey.trim()),
          onSelectJulesSession: handleSelectJulesSession,
          onRegenerate: () => {},
        }}
      />

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
          speechVoicesService.saveSpeechSettings(newSettings);
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
        onBulkDeletePrompts={handleBulkDeleteSavedPrompts}
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
        onBulkDeleteProjects={(ids) => handleBulkDeleteProjects(ids, stopStream)}
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
        onBulkDeleteSessions={handleBulkDeleteJulesSessions}
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
