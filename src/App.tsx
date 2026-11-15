import React, { useState, useCallback } from "react";
import {
  ChatMessage,
  MessageAttachment,
  IncomingMessage,
} from "./types";
import { RemoteFileSource } from "./types/integrations";
import { TopAppBar } from "./components/TopAppBar";
import { WorkspaceRouter, IDEOpenedFile } from "./components/WorkspaceRouter";
import { TunerBottomSheet } from "./components/TunerBottomSheet";
import { UnifiedSettingsModal } from "./components/UnifiedSettingsModal";
import { AndroidFrame } from "./components/AndroidFrame";
import { BottomNavBar } from "./components/BottomNavBar";
import { CustomTabBrowserModal } from "./components/CustomTabBrowserModal";
import { ImportProjectSheet } from "./components/ImportProjectSheet";
import { SecurePrivacyShield } from "./components/SecurePrivacyShield";
import { ClipboardKeyBanner } from "./components/ClipboardKeyBanner";
import { AuthRequiredBanner } from "./components/AuthRequiredBanner";
import { StreamErrorBanner } from "./components/StreamErrorBanner";
import { WorkspaceProvider } from "./contexts/WorkspaceContext";
import { useGeminiStream } from "./hooks/useGeminiStream";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { useClipboardKeySniffer } from "./hooks/useClipboardKeySniffer";
import { useWindowSecurity } from "./hooks/useWindowSecurity";
import {

// removed projectsManager
} from "./utils/storage";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { StorageWarningBanner } from "./components/StorageWarningBanner";
import { PWAUpdateBanner } from "./components/PWAUpdateBanner";
import { useAppState } from "./hooks/useAppState";
import { useServices } from "./services/ServiceContext";
import { useProviderConnections } from "./hooks/useProviderConnections";
import { isLocalProvider } from "./utils/providerCatalog";
import { ErrorBoundary } from "./components/ErrorBoundary";


export default function App() {
  const { keyVerificationService, speechVoicesService, projectService, stubsClient, idGenerator, timeProvider } = useServices();

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
    handleToggleTemplate,
    handleRemoveTemplate,
    handleClearAllTemplates,
    handleOpenSettings,
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

  // Dedicated resilient streaming hook
  const {
    isGenerating,
    error: streamError,
    errorDetails,
    getLastError,
    startStream,
    stopStream,
    clearError,
  } = useGeminiStream({
    customApiKey,
    onError: (err) => {
      if (err.isKeyInvalid || err.isAuthError || err.isRevoked) {
        if (activeProject) {
          projectService.projectsManager.collection.update(activeProject.id, {
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
          setProjects((prev) =>
            prev.map((p) =>
              p.id === activeProject.id
                ? { ...p, isValid: false, status: "invalid_key", statusMessage: "Key expired or revoked" }
                : p
            )
          );
        }
      }
    },
  });

  // Online / offline network detection
  const { isOnline } = useNetworkStatus();
  const { webllmProgress } = useProviderConnections();

  const currentModelObj =
    models.find(
      (m) =>
        m.id === config.model &&
        (!config.providerId || !m.providerId || m.providerId === config.providerId)
    ) || models.find((m) => m.id === config.model);
  const currentModelName = currentModelObj ? currentModelObj.name : config.model;
  const activeProviderId = currentModelObj?.providerId || config.providerId || "google";
  const isActiveModelLocal = isLocalProvider(activeProviderId);

  // Workspace files opened in Mobile IDE (e.g., from Stubs architecture diagrams)
  const [openedWorkspaceFiles, setOpenedWorkspaceFiles] = useState<IDEOpenedFile[]>([]);
  const [activeWorkspaceFilePath, setActiveWorkspaceFilePath] = useState<string | null>(null);
  const [isLoadingWorkspaceFile, setIsLoadingWorkspaceFile] = useState(false);
  const [workspaceFileError, setWorkspaceFileError] = useState<string | null>(null);

  const handleOpenFileInIDE = useCallback(
    async (filePath: string) => {
      const normalized = filePath.replace(/\\/g, "/").replace(/^\/+/, "");
      if (!normalized) return;

      setPromptType("code");
      setActiveWorkspaceFilePath(normalized);
      setWorkspaceFileError(null);

      const alreadyOpen = openedWorkspaceFiles.some((f) => f.path === normalized);
      if (alreadyOpen) {
        return;
      }

      setIsLoadingWorkspaceFile(true);
      try {
        const fetched = await stubsClient.fetchWorkspaceFile(normalized);
        setOpenedWorkspaceFiles((prev) => {
          if (prev.some((f) => f.path === fetched.path)) {
            return prev;
          }
          return [
            ...prev,
            {
              path: fetched.path,
              name: fetched.name,
              language: fetched.language,
              content: fetched.content,
              originalContent: fetched.content,
            },
          ];
        });
      } catch (err: unknown) {
        setWorkspaceFileError(err instanceof Error ? err.message : "Failed to load file into IDE");
      } finally {
        setIsLoadingWorkspaceFile(false);
      }
    },
    [openedWorkspaceFiles, setPromptType, stubsClient]
  );

  const handleUpdateWorkspaceFileContent = useCallback((filePath: string, content: string) => {
    setOpenedWorkspaceFiles((prev) =>
      prev.map((f) => (f.path === filePath ? { ...f, content } : f))
    );
  }, []);

  const handleResetWorkspaceFile = useCallback((filePath: string) => {
    setOpenedWorkspaceFiles((prev) =>
      prev.map((f) => (f.path === filePath ? { ...f, content: f.originalContent } : f))
    );
  }, []);

  const handleCloseWorkspaceFile = useCallback((filePath: string) => {
    setOpenedWorkspaceFiles((prev) => {
      const remaining = prev.filter((f) => f.path !== filePath);
      setActiveWorkspaceFilePath((current) => {
        if (current !== filePath) return current;
        return remaining.length > 0 ? remaining[remaining.length - 1].path : null;
      });
      return remaining;
    });
  }, []);

  const handleOpenRemoteFileInIDE = useCallback(
    (file: {
      path: string;
      name: string;
      language: string;
      content: string;
      remoteSource: RemoteFileSource;
    }) => {
      const normalized = file.path.replace(/\\/g, "/").replace(/^\/+/, "");
      if (!normalized) return;

      setOpenedWorkspaceFiles((prev) => {
        const exists = prev.some((f) => f.path === normalized);
        if (exists) {
          return prev.map((f) =>
            f.path === normalized
              ? {
                  ...f,
                  content: file.content,
                  originalContent: file.content,
                  remoteSource: file.remoteSource,
                }
              : f
          );
        }
        return [
          ...prev,
          {
            path: normalized,
            name: file.name,
            language: file.language,
            content: file.content,
            originalContent: file.content,
            remoteSource: file.remoteSource,
          },
        ];
      });
      setActiveWorkspaceFilePath(normalized);
      setWorkspaceFileError(null);
      setPromptType("code");
    },
    [setPromptType]
  );

  const handleUpdateOpenedFileRemoteSource = useCallback(
    (filePath: string, remoteSource: RemoteFileSource, syncedContent: string) => {
      setOpenedWorkspaceFiles((prev) =>
        prev.map((f) =>
          f.path === filePath
            ? { ...f, remoteSource, originalContent: syncedContent }
            : f
        )
      );
    },
    []
  );

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
    rawUserText?: string,
    baseMessages?: ChatMessage[]
  ) => {
    if (isGenerating || (!isOnline && !isActiveModelLocal)) return;
    if (!hasApiKey && !isActiveModelLocal) {
      handleOpenSettings("account");
      return;
    }

    const userMessage: ChatMessage = {
      id: idGenerator.generate("user"),
      role: "user",
      text,
      images: attachments,
      timestamp: timeProvider.now(),
      templateIds,
      rawUserText,
    };

    const baseHistory = baseMessages ?? messages;
    const updatedMessages = [...baseHistory, userMessage];

    // Placeholder model message for streaming
    const modelMessageId = idGenerator.generate("model");
    const placeholderModelMsg: ChatMessage = {
      id: modelMessageId,
      role: "model",
      text: "",
      timestamp: timeProvider.now(),
      isStreaming: true,
      modelName: currentModelName,
      providerId: activeProviderId,
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
        providerId: activeProviderId,
        connectionId: currentModelObj?.connectionId || config.connectionId,
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
      const latestError = getLastError();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === modelMessageId
            ? {
                ...m,
                isStreaming: false,
                error: latestError
                  ? latestError.message
                  : m.text.trim().length > 0
                    ? undefined
                    : "Generation stopped.",
              }
            : m
        )
      );
    }
  };

  // Regenerate last response
  const handleRegenerate = () => {
    if (messages.length === 0 || isGenerating || (!isOnline && !isActiveModelLocal)) return;
    const lastUserIdx = messages.map((m) => m.role).lastIndexOf("user");
    if (lastUserIdx === -1) return;

    const trimmed = messages.slice(0, lastUserIdx + 1);
    const lastUser = trimmed[trimmed.length - 1];
    const baseHistory = trimmed.slice(0, -1);
    setMessages(baseHistory);
    void handleSendMessage(
      lastUser.text,
      lastUser.images,
      lastUser.templateIds,
      lastUser.rawUserText,
      baseHistory
    );
  };

  const totalTokensEstimate = (() => {
    const sysTokens = Math.round((config.systemInstruction?.length || 0) / 4);
    if (promptType === "chat") {
      const msgTokens = messages.reduce((acc, m) => {
        return acc + (m.tokenCount || Math.round((m.text?.length || 0) / 4));
      }, 0);
      return msgTokens + sysTokens;
    }
    return sysTokens;
  })();

  return (
    <AndroidFrame mode={deviceMode}>
      <OfflineIndicator />
      <StorageWarningBanner />
      <PWAUpdateBanner isGenerating={isGenerating} />

      {/* FLAG_SECURE Privacy Shield to obscure sensitive snapshots in App Switcher */}
      <SecurePrivacyShield isActive={isShieldActive} />

      {/* Top Application Bar */}
      <TopAppBar
        promptType={promptType}
        onSelectPromptType={(type) => {
          setPromptType(type);
        }}
        currentModelName={currentModelName}
        onOpenParameters={() => setShowTunerSheet(true)}
        onOpenSettings={handleOpenSettings}
        onOpenBottomNav={() => setShowBottomNav(true)}
        hasApiKey={hasApiKey}
        totalTokens={totalTokensEstimate}
        maxTokens={1_000_000}
        systemInstruction={config.systemInstruction}
        onUpdateSystemInstruction={(inst) =>
          setConfig((prev) => ({ ...prev, systemInstruction: inst }))
        }
        onOpenCustomTabBrowser={() => {
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
        onOpenPromptTemplates={() => {
          if (promptType !== "chat") {
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
        hasApiKey={hasApiKey || isActiveModelLocal}
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
      <WorkspaceProvider value={{
          config,
          activeModelInfo: currentModelObj,
          webllmProgress,
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
          onOpenFileInIDE: (filePath) => void handleOpenFileInIDE(filePath),
          speechSettings,
          onSaveSpeechSettings: (newSettings) => {
            setSpeechSettings(newSettings);
            speechVoicesService.saveSpeechSettings(newSettings);
          }
        }}
      >
        <WorkspaceRouter
          promptType={promptType}
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
            onSwitchToPrompt: () => { setPromptType("chat"); },
            openedWorkspaceFiles,
            activeWorkspaceFilePath,
            isLoadingWorkspaceFile,
            workspaceFileError,
            onSelectWorkspaceFile: setActiveWorkspaceFilePath,
            onOpenWorkspaceFile: (filePath) => void handleOpenFileInIDE(filePath),
            onUpdateWorkspaceFileContent: handleUpdateWorkspaceFileContent,
            onResetWorkspaceFile: handleResetWorkspaceFile,
            onCloseWorkspaceFile: handleCloseWorkspaceFile,
            onOpenRemoteFileInIDE: handleOpenRemoteFileInIDE,
            onUpdateRemoteSource: handleUpdateOpenedFileRemoteSource,
          }}
          stubsProps={{}}
        />
      </WorkspaceProvider>

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
      <ErrorBoundary scope="tuner" onReset={() => setShowTunerSheet(false)}>
        <TunerBottomSheet
          isOpen={showTunerSheet}
          config={config}
          onChangeConfig={setConfig}
          models={models}
          onClose={() => setShowTunerSheet(false)}
          isModal={true}
          hasApiKey={hasApiKey}
          onOpenAuth={() => handleOpenSettings("account")}
          onOpenProviders={() => {
            setShowTunerSheet(false);
            handleOpenSettings("providers");
          }}
        />
      </ErrorBoundary>

      {/* Unified Settings Modal Hub */}
      <ErrorBoundary scope="settings" onReset={() => setShowSettingsModal(false)}>
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
          openedWorkspaceFiles={openedWorkspaceFiles}
          activeWorkspaceFilePath={activeWorkspaceFilePath}
          onOpenRemoteFileInIDE={(file) => {
            handleOpenRemoteFileInIDE(file);
            setShowSettingsModal(false);
          }}
        />
      </ErrorBoundary>

      {/* Phase 2: In-App AI Studio Launcher (Chrome Custom Tab style) */}
      <ErrorBoundary scope="browser" onReset={() => setShowCustomTabBrowser(false)}>
        <CustomTabBrowserModal
          isOpen={showCustomTabBrowser}
          onClose={() => setShowCustomTabBrowser(false)}
          activeApiKey={customApiKey}
          onImportKey={(key) => {
            setCandidateClipboardKey(key);
            setShowImportModal(true);
            setShowCustomTabBrowser(false);
          }}
        />
      </ErrorBoundary>

      {/* Phase 2: Import Project Modal / Bottom Sheet */}
      <ErrorBoundary scope="import" onReset={() => setShowImportModal(false)}>
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
      </ErrorBoundary>

    </AndroidFrame>
  );
}
