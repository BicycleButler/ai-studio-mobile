import { useSettingsProjectsState } from "../hooks/settings/useSettingsProjectsState";
import { useGoogleAuth } from "../hooks/useGoogleAuth";
import { SettingsAudioTab } from "./settings/SettingsAudioTab";
import { SettingsSidebar } from "./settings/SettingsSidebar";
import { getSafeDocument, safeAddEventListener } from "../utils/platform";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Volume2,
  Sliders,

  FolderHeart,
  Code2,
  Compass,
  Sun,
  User,
  Layers,
  ArrowLeft,
} from "lucide-react";
import {
  PromptConfig,
  ModelInfo,
  DeviceFrameMode,
  SavedPrompt,
  ChatMessage,
  ProjectInfo,
} from "../types";
import { TunerBottomSheet } from "./TunerBottomSheet";
import {
    SpeechSettings,
  } from "../services/speechVoices";
import { LibraryModal } from "./LibraryModal";
import { CodeExportModal } from "./CodeExportModal";
import { DesktopWrapperGuide } from "./DesktopWrapperGuide";
import { useTheme } from "../hooks/useTheme";
import { SettingsDisplayTab } from "./settings/SettingsDisplayTab";
import { SettingsAccountTab } from "./settings/SettingsAccountTab";
import { SettingsSecurityTab } from "./settings/SettingsSecurityTab";
import { useBackNavigation } from "../hooks/useBackNavigation";
import { useServices } from "../services/ServiceContext";
import { SettingsTab } from "../types";

export interface AccountSettingsProps {
  customApiKey: string;
  onSaveCustomApiKey: (key: string) => void;
  julesApiKey?: string;
  onSaveJulesApiKey?: (key: string) => void;
  hasServerKey: boolean;
  onRefreshServerAuth?: () => void;
}

export interface ProjectSettingsProps {
  onOpenCustomTabBrowser?: (service?: "aistudio" | "jules") => void;
  onOpenImportProject?: () => void;
  activeProjectName?: string;
  projects?: ProjectInfo[];
  activeProject?: ProjectInfo | null;
  onSelectProject?: (project: ProjectInfo) => void;
  onRenameProject?: (id: string, newName: string) => void;
  onDeleteProject?: (id: string) => void;
  onBulkDeleteProjects?: (ids: string[]) => void;
}

export interface SpeechSettingsProps {
  speechSettings: SpeechSettings;
  onSaveSpeechSettings: (newSettings: SpeechSettings) => void;
}

export interface LibrarySettingsProps {
  savedPrompts?: SavedPrompt[];
  onLoadPrompt?: (prompt: SavedPrompt) => void;
  onSaveCurrentPrompt?: (title: string) => void;
  onDeletePrompt?: (id: string) => void;
  onBulkDeletePrompts?: (ids: string[]) => void;
}

export interface ConfigSettingsProps {
  onOpenParameters?: () => void;
  config?: PromptConfig;
  onChangeConfig?: (newConfig: PromptConfig) => void;
  models?: ModelInfo[];
}

export interface UnifiedSettingsModalProps
  extends AccountSettingsProps,
          ProjectSettingsProps,
          SpeechSettingsProps,
          LibrarySettingsProps,
          ConfigSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
  liveModelsCount?: number;

  // Export
  messages?: ChatMessage[];

  // Display & Appearance
  deviceMode: DeviceFrameMode;
  onSelectDeviceMode: (mode: DeviceFrameMode) => void;
}

export const UnifiedSettingsModal: React.FC<UnifiedSettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = "account",
  customApiKey,
  onSaveCustomApiKey: _onSaveCustomApiKey,
  julesApiKey = "",
  onSaveJulesApiKey: _onSaveJulesApiKey,
  hasServerKey,
  onRefreshServerAuth,
  liveModelsCount = 55,
  onOpenCustomTabBrowser: _onOpenCustomTabBrowser,
  onOpenImportProject,
  activeProjectName: _activeProjectName,
  projects = [],
  activeProject = null,
  onSelectProject,
  onRenameProject,
  onDeleteProject,
  onBulkDeleteProjects,
  speechSettings,
  onSaveSpeechSettings,
  onOpenParameters: _onOpenParameters,
  config,
  onChangeConfig,
  models = [],
  savedPrompts = [],
  onLoadPrompt,
  onSaveCurrentPrompt,
  onDeletePrompt,
  onBulkDeletePrompts,
  messages = [],
  deviceMode,
  onSelectDeviceMode,
}) => {
  const { mode: themeMode, setThemeMode } = useTheme();

  const handleSelectAudioEngine = (engine: "gemini" | "device") => {
    onSaveSpeechSettings({ ...speechSettings, engine });
  };
  const handleSelectGeminiVoice = (voice: string) => {
    onSaveSpeechSettings({ ...speechSettings, geminiVoice: voice });
  };
  const handleSelectDeviceVoice = (voiceId: string) => {
    onSaveSpeechSettings({ ...speechSettings, deviceVoiceURI: voiceId });
  };
  const handleSelectRate = (rate: number) => {
    onSaveSpeechSettings({ ...speechSettings, playbackRate: rate });
  };


  // Normalize initialTab to canonical tabs
  const resolveTab = (
    tab?: SettingsTab
  ): "account" | "display" | "security" | "model" | "audio" | "library" | "export" | "companion" => {
    if (!tab) return "account";
    if (tab === "auth" || tab === "key" || tab === "profile") return "account";
    if (tab === "display" || tab === "theme" || tab === "themes") return "display";
    if (tab === "settings") return "security";
    if (tab === "tune" || tab === "model" || tab === "models") return "model";
    return tab as "account" | "display" | "security" | "model" | "audio" | "library" | "export" | "companion";
  };

  const [activeTab, setActiveTab] = useState<SettingsTab>(resolveTab(initialTab));

  // Sync initial tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(resolveTab(initialTab));
    }
  }, [isOpen, initialTab]);



  // Batch Selection State
  const {
    selectedProjectIds,
    toggleProjectSelection: _toggleProjectSelection,
    toggleSelectAllProjectsRaw,
    clearProjectSelection,
    handleBulkDeleteProjects,
    getProjectSelectionState,
  } = useSettingsProjectsState(projects, activeTab, onBulkDeleteProjects, onDeleteProject);

  const toggleSelectAllProjects = useCallback(() => {
    toggleSelectAllProjectsRaw(projects);
  }, [toggleSelectAllProjectsRaw, projects]);


  const { generalSettingsService } = useServices();
  const [flagSecure, setFlagSecure] = useState<boolean>(() => generalSettingsService.isFlagSecureEnabled());

  // Enable device/browser back navigation to dismiss drawer smoothly
  useBackNavigation(isOpen, () => {

    onClose();
  }, "settings-drawer");

  // Keyboard shortcuts and Escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedProjectIds.size > 0 && activeTab === "account") {
          clearProjectSelection();
        } else {

          onClose();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "a" && activeTab === "account") {
        if (getSafeDocument()!.activeElement?.tagName !== 'INPUT' && getSafeDocument()!.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          toggleSelectAllProjects();
        }
      }
    };
    const removeKey = safeAddEventListener("keydown", handleKeyDown);
    return () => removeKey();
  }, [isOpen, onClose, activeTab, selectedProjectIds.size, clearProjectSelection, toggleSelectAllProjects]);


  // Audio state


  const { user } = useGoogleAuth();
  const hasAnyAuth = Boolean(user || customApiKey.trim() || hasServerKey);
  const isJulesConfigured = Boolean(julesApiKey.trim());

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="unified-settings-backdrop"
          id="unified-settings-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {

              onClose();
            }
          }}
        >
          <motion.div
            key="unified-settings-dialog"
            id="unified-settings-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Settings and Hub drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-0 z-50 w-full h-full h-[100dvh] bg-background border-none shadow-2xl flex flex-col overflow-hidden text-foreground"
          >
        {/* Top Drawer Header with Back button */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border bg-background/95 backdrop-blur-md shrink-0 select-none">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              id="settings-modal-back-btn"
              onClick={() => {

                onClose();
              }}
              className="p-2 -ms-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer flex items-center gap-1.5 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title="Close drawer"
              aria-label="Back / Close drawer"
            >
              <ArrowLeft className="rtl:rotate-180 w-5 h-5" />
              <span className="text-xs font-semibold sm:inline hidden">Back</span>
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                {activeTab === "account" ? (
                  <User className="w-4 h-4" />
                ) : activeTab === "display" ? (
                  <Sun className="w-4 h-4" />
                ) : activeTab === "security" ? (
                  <Sliders className="w-4 h-4" />
                ) : activeTab === "model" ? (
                  <Layers className="w-4 h-4" />
                ) : activeTab === "audio" ? (
                  <Volume2 className="w-4 h-4" />
                ) : activeTab === "library" ? (
                  <FolderHeart className="w-4 h-4" />
                ) : activeTab === "export" ? (
                  <Code2 className="w-4 h-4" />
                ) : (
                  <Compass className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-semibold text-foreground tracking-tight truncate">
                  {activeTab === "account"
                    ? "Profile & Account"
                    : activeTab === "display"
                    ? "Themes & Appearance"
                    : activeTab === "security"
                    ? "Settings & Security"
                    : activeTab === "model"
                    ? "Models & Tuners"
                    : activeTab === "audio"
                    ? "Voice & Audio"
                    : activeTab === "library"
                    ? "Prompt Library"
                    : activeTab === "export"
                    ? "Get Code"
                    : "Companion & Guide"}
                </h2>
                <p className="text-[11px] text-muted-foreground hidden sm:block truncate">
                  Slide-out drawer configuration for your active workspace
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              id="settings-modal-close-btn"
              onClick={() => {

                onClose();
              }}
              className="w-10 h-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer flex items-center justify-center touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title="Close drawer"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <SettingsSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          hasAnyAuth={hasAnyAuth}
        />

        {/* Scrollable Tab Body */}
        <div
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-btn-${activeTab}`}
          className="p-4 sm:p-6 lg:p-8 overflow-y-auto flex-1 space-y-6 max-w-4xl mx-auto w-full"
        >
          {/* TAB 1: CONSOLIDATED ACCOUNT & KEYS HUB (Q1) */}
          {activeTab === "account" && (
            <SettingsAccountTab
              customApiKey={customApiKey}
              hasServerKey={hasServerKey}
              onRefreshServerAuth={onRefreshServerAuth}
              onOpenCustomTabBrowser={() => {}} // Replace if there's a real handler
              isVerifyingKey={false}
              localKeyValidationResult={null}
              julesApiKey={julesApiKey}
              isVerifyingJulesKey={false}
              julesKeyValidationResult={null}
              activeProject={activeProject}
              projects={projects}
              onOpenImportProject={() => onOpenImportProject && onOpenImportProject()}
              onSelectProject={(p) => {
                if (onSelectProject) onSelectProject(p);
                onClose();
              }}
              onRenameProject={(p) => onRenameProject && onRenameProject(p.id, p.name)}
              onDeleteProject={(p) => { if (onDeleteProject) onDeleteProject(p.id); }}
              onBulkDeleteProjects={onBulkDeleteProjects}
              selectedProjectIds={selectedProjectIds}
              toggleProjectSelection={_toggleProjectSelection}
              toggleSelectAllProjects={toggleSelectAllProjects}
              clearProjectSelection={clearProjectSelection}
              getProjectSelectionState={getProjectSelectionState}
              handleBulkDeleteProjects={handleBulkDeleteProjects}
              liveModelsCount={liveModelsCount}
            />
          )}
          {/* TAB 2: VOICE & SPEECH */}
          {activeTab === "audio" && (
            <SettingsAudioTab
              currentSpeechSettings={speechSettings}
              handleSelectAudioEngine={handleSelectAudioEngine}
              handleSelectGeminiVoice={handleSelectGeminiVoice}
              handleSelectDeviceVoice={handleSelectDeviceVoice}
              handleSelectRate={handleSelectRate}
            />
          )}

          {/* TAB 3: DISPLAY & APPEARANCE */}
          {activeTab === "display" && (
            <SettingsDisplayTab
              themeMode={themeMode}
              setThemeMode={setThemeMode}
              deviceMode={deviceMode}
              onSelectDeviceMode={onSelectDeviceMode}
            />
          )}

          {/* TAB 4: SECURITY & PRIVACY */}
          {activeTab === "security" && (
            <SettingsSecurityTab
              flagSecure={flagSecure}
              setFlagSecure={setFlagSecure}
            />
          )}

          {/* TAB: MODELS & TUNERS */}
          {activeTab === "model" && (
            <div className="space-y-4">
              {config && onChangeConfig ? (
                <TunerBottomSheet
                  config={config}
                  onChangeConfig={onChangeConfig}
                  models={models || []}
                  isModal={false}
                  hasApiKey={hasAnyAuth}
                  onOpenAuth={() => setActiveTab("account")}
                />
              ) : (
                <div className="p-8 rounded-2xl border border-border bg-card text-center space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                    <Layers className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">Models & Parameters</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Configure Gemini models, temperature, reasoning limits, and structured schemas directly within your active workspace.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: PROMPT LIBRARY & TEMPLATES */}
          {activeTab === "library" && (
            <div className="space-y-4">
              <LibraryModal
                savedPrompts={savedPrompts}
                onLoadPrompt={(p) => {
                  if (onLoadPrompt) onLoadPrompt(p);
                  onClose();
                }}
                onSaveCurrentPrompt={onSaveCurrentPrompt || (() => {})}
                onDeletePrompt={onDeletePrompt || (() => {})}
                onBulkDeletePrompts={onBulkDeletePrompts}
                isEmbedded={true}
              />
            </div>
          )}

          {/* TAB 6: GET CODE */}
          {activeTab === "export" && config && (
            <div className="space-y-4">
              <CodeExportModal
                config={config}
                messages={messages}
                isEmbedded={true}
              />
            </div>
          )}

          {/* TAB 7: COMPANION & ABOUT */}
          {activeTab === "companion" && (
            <div className="space-y-4">
              <DesktopWrapperGuide
                onOpenApiKeyModal={() => setActiveTab("account")}
                isEmbedded={true}
              />
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-border bg-background/95 backdrop-blur-md shrink-0">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
              <span
                className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border font-semibold shrink-0 ${
                  hasAnyAuth
                    ? "bg-primary/20 text-primary border-primary/30"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                {hasAnyAuth ? "Ready" : "Unauthenticated"}
              </span>
              <span className="truncate hidden sm:inline">
                {hasAnyAuth
                  ? isJulesConfigured
                    ? "Gemini & Jules Active"
                    : "Gemini AI Studio Connected"
                  : "API Key Required"}
              </span>
            </div>

            <button
              type="button"
              id="settings-done-btn"
              onClick={() => {

                onClose();
              }}
              className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-md active:scale-95 transition cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Done
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
    )}
  </AnimatePresence>
  );
};
