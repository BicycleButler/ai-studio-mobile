import { useBatchSelection } from "../hooks/useBatchSelection";
import { safeAddEventListener, getSafeWindowSpeechSynthesis } from "../utils/platform";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FloatingBatchActionBar } from "./FloatingBatchActionBar";
import {
  X,
  Volume2,
  Sliders,
  Smartphone,
  Check,
  Loader2,
  Square,
  Sparkles,
  Radio,
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
  GoogleUser,
  ProjectInfo,
} from "../types";
import { fetchTTSAudioUrl } from "../services/speechVoices";
import { TunerBottomSheet } from "./TunerBottomSheet";
import {
  GEMINI_VOICES,
  SpeechSettings,
  getAvailableDeviceVoices,
  DeviceVoiceOption,
} from "../services/speechVoices";
import { LibraryModal } from "./LibraryModal";
import { CodeExportModal } from "./CodeExportModal";
import { DesktopWrapperGuide } from "./DesktopWrapperGuide";
import { isFlagSecureEnabled } from "../utils/storage";
import { useTheme } from "../hooks/useTheme";
import { SettingsDisplayTab } from "./settings/SettingsDisplayTab";
import { SettingsAccountTab } from "./settings/SettingsAccountTab";
import { SettingsSecurityTab } from "./settings/SettingsSecurityTab";
import { useBackNavigation } from "../hooks/useBackNavigation";


export type SettingsTab =
  | "account"
  | "auth"
  | "key"
  | "profile"
  | "audio"
  | "display"
  | "theme"
  | "themes"
  | "security"
  | "settings"
  | "library"
  | "export"
  | "companion"
  | "tune"
  | "model"
  | "models";

export interface AccountSettingsProps {
  customApiKey: string;
  onSaveCustomApiKey: (key: string) => void;
  julesApiKey?: string;
  onSaveJulesApiKey?: (key: string) => void;
  hasServerKey: boolean;
  onRefreshServerAuth?: () => void;
  googleUser?: GoogleUser | null;
  onGoogleLogin?: (email?: string, name?: string) => Promise<void>;
  onGoogleLogout?: () => Promise<void>;
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
  googleUser = null,
  onGoogleLogin,
  onGoogleLogout,
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

  const [activeTab, setActiveTab] = useState<
    "account" | "display" | "security" | "model" | "audio" | "library" | "export" | "companion"
  >(resolveTab(initialTab));

  // Sync initial tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(resolveTab(initialTab));
    }
  }, [isOpen, initialTab]);



  // Batch Selection State
  const {
    selectedIds: selectedProjectIds,
    showBulkDeleteConfirm: showBulkDeleteProjectsConfirm,
    setShowBulkDeleteConfirm: setShowBulkDeleteProjectsConfirm,
    bulkDeleteConfirmationText,
    setBulkDeleteConfirmationText,
    toggleSelection: _toggleProjectSelection,
    toggleSelectAll: toggleSelectAllProjectsRaw,
    clearSelection: clearProjectSelection,
    handleBulkDelete: handleBulkDeleteProjects,
  } = useBatchSelection({
    items: projects,
    getItemId: (p) => p.id,
    onBulkDelete: onBulkDeleteProjects
      ? onBulkDeleteProjects
      : (ids) => ids.forEach((id) => onDeleteProject && onDeleteProject(id)),
  });

  const toggleSelectAllProjects = useCallback(() => {
    toggleSelectAllProjectsRaw(projects);
  }, [toggleSelectAllProjectsRaw, projects]);

  // Clear project selection when switching tabs (ADR 0047)
  useEffect(() => {
    clearProjectSelection();
  }, [activeTab, clearProjectSelection]);
  const [flagSecure, setFlagSecure] = useState<boolean>(() => isFlagSecureEnabled());

  // Enable device/browser back navigation to dismiss drawer smoothly
  useBackNavigation(isOpen, () => {
    stopPreview();
    onClose();
  }, "settings-drawer");

  // Keyboard shortcuts and Escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showBulkDeleteProjectsConfirm) {
           setShowBulkDeleteProjectsConfirm(false);
           setBulkDeleteConfirmationText("");
        } else if (selectedProjectIds.size > 0 && activeTab === "account") {
          clearProjectSelection();
        } else {
          stopPreview();
          onClose();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "a" && activeTab === "account") {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          toggleSelectAllProjects();
        }
      }
    };
    const removeKey = safeAddEventListener("keydown", handleKeyDown);
    return () => removeKey();
  }, [isOpen, onClose, activeTab, selectedProjectIds.size, clearProjectSelection, toggleSelectAllProjects, showBulkDeleteProjectsConfirm]);


  // Audio state
  const [currentSpeechSettings, setCurrentSpeechSettings] = useState<SpeechSettings>(speechSettings);
  const [deviceVoices, setDeviceVoices] = useState<DeviceVoiceOption[]>([]);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setCurrentSpeechSettings(speechSettings);
  }, [speechSettings]);

  useEffect(() => {
    if (!isOpen) return;
    const loadVoices = () => {
      const voices = getAvailableDeviceVoices();
      setDeviceVoices(voices);
      if (voices.length > 0 && !currentSpeechSettings.deviceVoiceURI) {
        setCurrentSpeechSettings((prev) => ({
          ...prev,
          deviceVoiceURI: voices[0].voiceURI,
        }));
      }
    };
    loadVoices();
    const synth = getSafeWindowSpeechSynthesis();
    if (synth) {
      synth.onvoiceschanged = loadVoices;
    }
  }, [isOpen, currentSpeechSettings.deviceVoiceURI]);

  // Clean up audio playback when closing or unmounting
  useEffect(() => {
    return () => {
      stopPreview();
    };
  }, [isOpen]);

  const stopPreview = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    const synth = getSafeWindowSpeechSynthesis();
    if (synth) {
      synth.cancel();
    }
    setPreviewingVoiceId(null);
    setIsPreviewLoading(false);
  };


  // Audio Actions
  const handlePreviewVoice = async (voiceName: string, engine: "gemini" | "device") => {
    if (previewingVoiceId === voiceName) {
      stopPreview();
      return;
    }

    stopPreview();
    setPreviewError(null);
    setPreviewingVoiceId(voiceName);

    const samplePhrase = `Hello! I'm ${voiceName}, ready to narrate your Gemini responses.`;

    if (engine === "gemini") {
      setIsPreviewLoading(true);
      try {
        const data = await fetchTTSAudioUrl(samplePhrase, voiceName);

        if (!data.audioUrl) {
          throw new Error("No audio returned from Gemini TTS");
        }

        setIsPreviewLoading(false);
        const audio = new Audio(data.audioUrl);
        audio.playbackRate = currentSpeechSettings.playbackRate;
        previewAudioRef.current = audio;

        audio.onended = () => {
          setPreviewingVoiceId(null);
          previewAudioRef.current = null;
        };

        audio.onerror = () => {
          setPreviewingVoiceId(null);
          previewAudioRef.current = null;
          setPreviewError("Failed to play audio preview.");
        };

        await audio.play();
      } catch (err: unknown) {
        setIsPreviewLoading(false);
        setPreviewingVoiceId(null);
        setPreviewError(err instanceof Error ? err.message : "Error previewing voice.");
      }
    } else {
      const synth = getSafeWindowSpeechSynthesis();
      if (!synth) {
        setPreviewError("Device speech synthesis not available.");
        setPreviewingVoiceId(null);
        return;
      }

      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(samplePhrase);
      utterance.rate = currentSpeechSettings.playbackRate;

      const rawVoices = synth.getVoices();
      const selectedVoice = rawVoices.find(
        (v) => v.voiceURI === currentSpeechSettings.deviceVoiceURI
      );
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.onend = () => {
        setPreviewingVoiceId(null);
      };

      utterance.onerror = () => {
        setPreviewingVoiceId(null);
        setPreviewError("Error playing on-device voice.");
      };

      synth.speak(utterance);
    }
  };

  const handleSelectAudioEngine = (engine: "gemini" | "device") => {
    stopPreview();
    const updated: SpeechSettings = { ...currentSpeechSettings, engine };
    setCurrentSpeechSettings(updated);
    onSaveSpeechSettings(updated);
  };

  const handleSelectGeminiVoice = (geminiVoice: string) => {
    const updated: SpeechSettings = { ...currentSpeechSettings, geminiVoice };
    setCurrentSpeechSettings(updated);
    onSaveSpeechSettings(updated);
  };

  const handleSelectDeviceVoice = (deviceVoiceURI: string) => {
    const updated: SpeechSettings = { ...currentSpeechSettings, deviceVoiceURI };
    setCurrentSpeechSettings(updated);
    onSaveSpeechSettings(updated);
  };

  const handleSelectRate = (playbackRate: number) => {
    const updated: SpeechSettings = { ...currentSpeechSettings, playbackRate };
    setCurrentSpeechSettings(updated);
    onSaveSpeechSettings(updated);
    if (previewAudioRef.current) {
      previewAudioRef.current.playbackRate = playbackRate;
    }
  };

  const handleToggleAutoRead = () => {
    const updated: SpeechSettings = {
      ...currentSpeechSettings,
      autoReadResponses: !currentSpeechSettings.autoReadResponses,
    };
    setCurrentSpeechSettings(updated);
    onSaveSpeechSettings(updated);
  };

  const handleToggleHandsFree = () => {
    const updated: SpeechSettings = {
      ...currentSpeechSettings,
      handsFreeMode: !currentSpeechSettings.handsFreeMode,
    };
    setCurrentSpeechSettings(updated);
    onSaveSpeechSettings(updated);
  };

  const handleToggleSentenceStreaming = () => {
    const updated: SpeechSettings = {
      ...currentSpeechSettings,
      sentenceStreaming: !currentSpeechSettings.sentenceStreaming,
    };
    setCurrentSpeechSettings(updated);
    onSaveSpeechSettings(updated);
  };

  const handleSelectSilenceTimeout = (silenceTimeoutMs: number) => {
    const updated: SpeechSettings = {
      ...currentSpeechSettings,
      silenceTimeoutMs,
    };
    setCurrentSpeechSettings(updated);
    onSaveSpeechSettings(updated);
  };

  const handleSelectVoiceButtonPlacement = (placement: "footer" | "fab") => {
    const updated: SpeechSettings = {
      ...currentSpeechSettings,
      voiceButtonPlacement: placement,
    };
    setCurrentSpeechSettings(updated);
    onSaveSpeechSettings(updated);
  };

  const hasAnyAuth = Boolean(googleUser || customApiKey.trim() || hasServerKey);
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
          transition={{ duration: 1.89, ease: "easeOut" }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              stopPreview();
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
            transition={{ duration: 1.89, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-0 z-50 w-full h-full h-[100dvh] bg-background border-none shadow-2xl flex flex-col overflow-hidden text-foreground"
          >
        {/* Top Drawer Header with Back button */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border bg-background/95 backdrop-blur-md shrink-0 select-none">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              id="settings-modal-back-btn"
              onClick={() => {
                stopPreview();
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
                stopPreview();
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

        {/* Tab Navigation: Profile, Themes, Settings, Models, Audio, Library, Get Code, Companion */}
        <div
          role="tablist"
          aria-label="Settings and Hub sections"
          className="flex border-b border-border bg-muted/40 px-2 sm:px-6 overflow-x-auto scrollbar-none shrink-0 touch-pan-x overscroll-x-contain gap-1"
        >
          <button
            type="button"
            role="tab"
            id="tab-btn-account"
            aria-selected={activeTab === "account"}
            aria-controls="tabpanel-account"
            onClick={() => {
              stopPreview();
              setActiveTab("account");
            }}
            className={`flex flex-col items-center justify-center gap-1.5 py-3 px-3 min-w-[76px] sm:min-w-[84px] text-xs transition-colors shrink-0 cursor-pointer border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              activeTab === "account"
                ? "border-primary text-primary bg-primary/10 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-border font-medium"
            }`}
          >
            <div className="relative flex items-center justify-center">
              <User className="w-4 h-4" />
              {!hasAnyAuth && (
                <span className="absolute -top-1 -end-2 text-[10px] font-mono text-destructive font-bold" title="Authentication needed">
                  !
                </span>
              )}
            </div>
            <span className="whitespace-nowrap text-[11px]">Profile</span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-btn-display"
            aria-selected={activeTab === "display"}
            aria-controls="tabpanel-display"
            onClick={() => {
              stopPreview();
              setActiveTab("display");
            }}
            className={`flex flex-col items-center justify-center gap-1.5 py-3 px-3 min-w-[76px] sm:min-w-[84px] text-xs transition-colors shrink-0 cursor-pointer border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              activeTab === "display"
                ? "border-primary text-primary bg-primary/10 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-border font-medium"
            }`}
          >
            <Sun className="w-4 h-4" />
            <span className="whitespace-nowrap text-[11px]">Themes</span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-btn-security"
            aria-selected={activeTab === "security"}
            aria-controls="tabpanel-security"
            onClick={() => {
              stopPreview();
              setActiveTab("security");
            }}
            className={`flex flex-col items-center justify-center gap-1.5 py-3 px-3 min-w-[76px] sm:min-w-[84px] text-xs transition-colors shrink-0 cursor-pointer border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              activeTab === "security"
                ? "border-primary text-primary bg-primary/10 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-border font-medium"
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span className="whitespace-nowrap text-[11px]">Settings</span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-btn-model"
            aria-selected={activeTab === "model"}
            aria-controls="tabpanel-model"
            onClick={() => {
              stopPreview();
              setActiveTab("model");
            }}
            className={`flex flex-col items-center justify-center gap-1.5 py-3 px-3 min-w-[76px] sm:min-w-[84px] text-xs transition-colors shrink-0 cursor-pointer border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              activeTab === "model"
                ? "border-primary text-primary bg-primary/10 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-border font-medium"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span className="whitespace-nowrap text-[11px]">Models</span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-btn-audio"
            aria-selected={activeTab === "audio"}
            aria-controls="tabpanel-audio"
            onClick={() => {
              stopPreview();
              setActiveTab("audio");
            }}
            className={`flex flex-col items-center justify-center gap-1.5 py-3 px-3 min-w-[76px] sm:min-w-[84px] text-xs transition-colors shrink-0 cursor-pointer border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              activeTab === "audio"
                ? "border-primary text-primary bg-primary/10 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-border font-medium"
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span className="whitespace-nowrap text-[11px]">Voice</span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-btn-library"
            aria-selected={activeTab === "library"}
            aria-controls="tabpanel-library"
            onClick={() => {
              stopPreview();
              setActiveTab("library");
            }}
            className={`flex flex-col items-center justify-center gap-1.5 py-3 px-3 min-w-[76px] sm:min-w-[84px] text-xs transition-colors shrink-0 cursor-pointer border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              activeTab === "library"
                ? "border-primary text-primary bg-primary/10 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-border font-medium"
            }`}
          >
            <FolderHeart className="w-4 h-4" />
            <span className="whitespace-nowrap text-[11px]">Library</span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-btn-export"
            aria-selected={activeTab === "export"}
            aria-controls="tabpanel-export"
            onClick={() => {
              stopPreview();
              setActiveTab("export");
            }}
            className={`flex flex-col items-center justify-center gap-1.5 py-3 px-3 min-w-[76px] sm:min-w-[84px] text-xs transition-colors shrink-0 cursor-pointer border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              activeTab === "export"
                ? "border-primary text-primary bg-primary/10 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-border font-medium"
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span className="whitespace-nowrap text-[11px]">Code</span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-btn-companion"
            aria-selected={activeTab === "companion"}
            aria-controls="tabpanel-companion"
            onClick={() => {
              stopPreview();
              setActiveTab("companion");
            }}
            className={`flex flex-col items-center justify-center gap-1.5 py-3 px-3 min-w-[76px] sm:min-w-[84px] text-xs transition-colors shrink-0 cursor-pointer border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              activeTab === "companion"
                ? "border-primary text-primary bg-primary/10 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-border font-medium"
            }`}
          >
            <Compass className="w-4 h-4" />
            <span className="whitespace-nowrap text-[11px]">Guide</span>
          </button>
        </div>

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
              googleUser={googleUser}
              onGoogleLogin={onGoogleLogin}
              onGoogleLogout={onGoogleLogout}
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
              liveModelsCount={liveModelsCount}
            />
          )}
          {/* TAB 2: VOICE & SPEECH */}
          {activeTab === "audio" && (
            <div className="space-y-4">
              {/* Engine Picker */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Voice Engine
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    id="settings-engine-gemini"
                    onClick={() => handleSelectAudioEngine("gemini")}
                    className={`p-3.5 rounded-xl border text-start transition-colors cursor-pointer ${
                      currentSpeechSettings.engine === "gemini"
                        ? "bg-primary/20 border-primary ring-1 ring-primary"
                        : "bg-card border-border hover:border-primary/50 hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span>Gemini AI Studio</span>
                      </div>
                      {currentSpeechSettings.engine === "gemini" && (
                        <span className="w-4 h-4 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[10px]">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Studio-grade neural voices with natural inflection and human cadence.
                    </p>
                  </button>

                  <button
                    type="button"
                    id="settings-engine-device"
                    onClick={() => handleSelectAudioEngine("device")}
                    className={`p-3.5 rounded-xl border text-start transition-colors cursor-pointer ${
                      currentSpeechSettings.engine === "device"
                        ? "bg-primary/20 border-primary ring-1 ring-primary"
                        : "bg-card border-border hover:border-primary/50 hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                        <Smartphone className="w-4 h-4 text-primary" />
                        <span>Device System</span>
                      </div>
                      {currentSpeechSettings.engine === "device" && (
                        <span className="w-4 h-4 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[10px]">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      On-device browser speech synthesis. Instant start and operates offline.
                    </p>
                  </button>
                </div>
              </div>

              {/* Gemini Voice Persona List */}
              {currentSpeechSettings.engine === "gemini" ? (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Gemini AI Voice Persona
                  </label>
                  <div className="space-y-2">
                    {GEMINI_VOICES.map((v) => {
                      const isSelected = currentSpeechSettings.geminiVoice === v.id;
                      const isPlaying = previewingVoiceId === v.id;

                      return (
                        <div
                          key={v.id}
                          onClick={() => handleSelectGeminiVoice(v.id)}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-primary/15 border-primary ring-1 ring-primary/40"
                              : "bg-card border-border hover:border-primary/50 hover:bg-muted"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-transparent"
                              }`}
                            >
                              {isSelected && (
                                <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-foreground">
                                  {v.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {v.personality}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {v.description}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewVoice(v.id, "gemini");
                            }}
                            className={`p-2 rounded-lg border text-xs font-medium shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer ${
                              isPlaying
                                ? "bg-primary border-primary text-primary-foreground"
                                : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary"
                            }`}
                            title={`Audition ${v.name}`}
                          >
                            {isPlaying ? (
                              <>
                                <Square className="w-3 h-3 fill-current" />
                                <span>Stop</span>
                              </>
                            ) : isPreviewLoading && previewingVoiceId === v.id ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                                <span>Loading</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3.5 h-3.5 text-primary" />
                                <span>Audition</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Device Voices ({deviceVoices.length} installed)
                  </label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pe-1">
                    {deviceVoices.slice(0, 12).map((v) => {
                      const isSelected =
                        currentSpeechSettings.deviceVoiceURI === v.voiceURI;
                      const isPlaying = previewingVoiceId === v.voiceURI;

                      return (
                        <div
                          key={v.voiceURI}
                          onClick={() => handleSelectDeviceVoice(v.voiceURI)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-primary/15 border-primary ring-1 ring-primary/40"
                              : "bg-card border-border hover:border-primary/50 hover:bg-muted"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pe-2">
                            <Radio
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isSelected
                                  ? "text-primary fill-primary"
                                  : "text-muted-foreground"
                              }`}
                            />
                            <div className="min-w-0">
                              <span className="font-medium text-xs text-foreground truncate block">
                                {v.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {v.lang}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewVoice(v.voiceURI, "device");
                            }}
                            className="p-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            {isPlaying ? (
                              <Square className="w-3 h-3 fill-current" />
                            ) : (
                              <Volume2 className="w-3 h-3 text-primary" />
                            )}
                          </button>
      {/* Floating Batch Action Bar for Projects */}
      <FloatingBatchActionBar
        isVisible={selectedProjectIds.size > 0}
        selectedCount={selectedProjectIds.size}
        onDelete={() => setShowBulkDeleteProjectsConfirm(true)}
        onClearSelection={clearProjectSelection}
        className="!z-[100] !shadow-xl"
      />

      {/* Bulk Delete Projects Confirmation Modal */}
      <AnimatePresence>
        {showBulkDeleteProjectsConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-card border border-border rounded-xl shadow-xl overflow-hidden"
            >
              <div className="p-4 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground">
                  Delete {selectedProjectIds.size} selected {selectedProjectIds.size === 1 ? 'project' : 'projects'}?
                </h3>
              </div>
              <div className="p-4 text-sm text-muted-foreground space-y-4">
                <p>
                  This action cannot be undone. This will permanently remove the selected projects from your workspace.
                </p>
              </div>
              <div className="p-4 bg-muted/40 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkDeleteProjectsConfirm(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkDeleteProjects}
                  disabled={selectedProjectIds.size > 100 && bulkDeleteConfirmationText !== selectedProjectIds.size.toString()}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed text-destructive-foreground transition-colors cursor-pointer shadow-sm"
                >
                  Delete {selectedProjectIds.size} {selectedProjectIds.size === 1 ? 'Project' : 'Projects'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Playback Speed */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Playback Speed
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[0.8, 1.0, 1.25, 1.5].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => handleSelectRate(rate)}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        currentSpeechSettings.playbackRate === rate
                          ? "bg-primary border-primary text-primary-foreground shadow-sm"
                          : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      {rate === 1.0 ? "1.0x (Normal)" : `${rate}x`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Two-Way Voice & Latency Optimizations */}
              <div className="pt-2 border-t border-border space-y-3">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Two-Way Voice & Latency Optimizations
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    100% free browser-native pipeline with zero external API fees.
                  </p>
                </div>

                {/* Hands-free Conversational Voice Mode Toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
                  <div className="space-y-0.5 pe-2">
                    <div className="text-xs font-semibold text-foreground">
                      Hands-Free Continuous Voice
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-relaxed">
                      Auto-sends upon pause, reads assistant responses, and resumes listening hands-free.
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={currentSpeechSettings.handsFreeMode}
                    onClick={handleToggleHandsFree}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      currentSpeechSettings.handsFreeMode ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        currentSpeechSettings.handsFreeMode ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Sentence Pipelining (Instant streaming audio) */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
                  <div className="space-y-0.5 pe-2">
                    <div className="text-xs font-semibold text-foreground">
                      Sentence Pipelining (Ultra-Low TTFA)
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-relaxed">
                      Synthesizes sentences in real time as tokens stream in (~250ms first-audio latency).
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={currentSpeechSettings.sentenceStreaming}
                    onClick={handleToggleSentenceStreaming}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      currentSpeechSettings.sentenceStreaming ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        currentSpeechSettings.sentenceStreaming ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Auto-Read Responses Toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
                  <div className="space-y-0.5 pe-2">
                    <div className="text-xs font-semibold text-foreground">
                      Auto-Read Responses
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-relaxed">
                      Automatically speaks responses aloud even outside full hands-free mode.
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={currentSpeechSettings.autoReadResponses}
                    onClick={handleToggleAutoRead}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      currentSpeechSettings.autoReadResponses ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        currentSpeechSettings.autoReadResponses ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Silence Pause Detection Delay */}
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Silence Pause Before Auto-Send
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "1.0s (Fast)", ms: 1000 },
                      { label: "1.5s (Balanced)", ms: 1500 },
                      { label: "2.0s (Relaxed)", ms: 2000 },
                    ].map((opt) => (
                      <button
                        key={opt.ms}
                        type="button"
                        onClick={() => handleSelectSilenceTimeout(opt.ms)}
                        className={`py-1.5 px-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                          currentSpeechSettings.silenceTimeoutMs === opt.ms
                            ? "bg-primary border-primary text-primary-foreground font-semibold shadow-sm"
                            : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hands-Free Button Style / Placement */}
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Hands-Free Voice Button Style
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      id="settings-voice-style-footer"
                      onClick={() => handleSelectVoiceButtonPlacement("footer")}
                      className={`p-2.5 rounded-xl border text-start transition-colors cursor-pointer ${
                        currentSpeechSettings.voiceButtonPlacement !== "fab"
                          ? "bg-primary/15 border-primary ring-1 ring-primary/40"
                          : "bg-card border-border hover:border-primary/50 hover:bg-muted"
                      }`}
                    >
                      <div className="text-xs font-semibold text-foreground">
                        Full-Width Footer Bar
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Docked above input composer
                      </p>
                    </button>

                    <button
                      type="button"
                      id="settings-voice-style-fab"
                      onClick={() => handleSelectVoiceButtonPlacement("fab")}
                      className={`p-2.5 rounded-xl border text-start transition-colors cursor-pointer ${
                        currentSpeechSettings.voiceButtonPlacement === "fab"
                          ? "bg-primary/15 border-primary ring-1 ring-primary/40"
                          : "bg-card border-border hover:border-primary/50 hover:bg-muted"
                      }`}
                    >
                      <div className="text-xs font-semibold text-foreground">
                        Floating Action Button
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Elevated FAB on bottom right
                      </p>
                    </button>
                  </div>
                </div>
              </div>

              {previewError && (
                <div className="p-3 rounded-xl bg-muted/40 border border-destructive/30 text-xs text-destructive">
                  {previewError}
                </div>
              )}
            </div>
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
                stopPreview();
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
