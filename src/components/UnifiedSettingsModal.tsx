import { isBrowserEnvironment, safeAddEventListener } from "../utils/platform";
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Volume2,
  Sliders,
  Smartphone,
  Laptop,
  Check,
  Loader2,
  Square,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Sparkles,
  Radio,
  FolderHeart,
  Code2,
  Compass,
  Trash2,
  Edit2,
  FolderPlus,
  Folder,
  CheckCircle2,
  Lock,
  AlertTriangle,
  Sun,
  Moon,
  Monitor,
  Bot,
  ClipboardPaste,
  ArrowLeft,
  User,
  Layers,
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
import { GoogleAuthCard } from "./GoogleAuthCard";
import { fetchAuthStatus } from "../services/auth";
import { verifyJulesApiKey } from "../services/keyVerification";
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
import { isFlagSecureEnabled, setFlagSecureEnabled } from "../utils/storage";
import { useTheme } from "../hooks/useTheme";
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

interface UnifiedSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;

  // Account, Keys & Projects
  customApiKey: string;
  onSaveCustomApiKey: (key: string) => void;
  julesApiKey?: string;
  onSaveJulesApiKey?: (key: string) => void;
  hasServerKey: boolean;
  onRefreshServerAuth?: () => void;
  googleUser?: GoogleUser | null;
  onGoogleLogin?: (email?: string, name?: string) => Promise<void>;
  onGoogleLogout?: () => Promise<void>;
  liveModelsCount?: number;
  onOpenCustomTabBrowser?: (service?: "aistudio" | "jules") => void;
  onOpenImportProject?: () => void;
  activeProjectName?: string;
  projects?: ProjectInfo[];
  activeProject?: ProjectInfo | null;
  onSelectProject?: (project: ProjectInfo) => void;
  onRenameProject?: (id: string, newName: string) => void;
  onDeleteProject?: (id: string) => void;

  // Audio / Speech
  speechSettings: SpeechSettings;
  onSaveSpeechSettings: (newSettings: SpeechSettings) => void;

  // Parameter trigger (canonical home is TunerBottomSheet)
  onOpenParameters?: () => void;
  config?: PromptConfig;
  onChangeConfig?: (newConfig: PromptConfig) => void;
  models?: ModelInfo[];

  // Library
  savedPrompts?: SavedPrompt[];
  onLoadPrompt?: (prompt: SavedPrompt) => void;
  onSaveCurrentPrompt?: (title: string) => void;
  onDeletePrompt?: (id: string) => void;

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
  onSaveCustomApiKey,
  julesApiKey = "",
  onSaveJulesApiKey,
  hasServerKey,
  onRefreshServerAuth,
  googleUser = null,
  onGoogleLogin,
  onGoogleLogout,
  liveModelsCount = 55,
  onOpenCustomTabBrowser,
  onOpenImportProject,
  activeProjectName,
  projects = [],
  activeProject = null,
  onSelectProject,
  onRenameProject,
  onDeleteProject,
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

  // Account, Keys & Project state
  const [inputApiKey, setInputApiKey] = useState(customApiKey);
  const [showKeyText, setShowKeyText] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Jules API key state
  const [julesInputKey, setJulesInputKey] = useState(julesApiKey);
  const [showJulesKeyText, setShowJulesKeyText] = useState(false);
  const [isTestingJulesKey, setIsTestingJulesKey] = useState(false);
  const [julesTestResult, setJulesTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Project editing
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const [deleteConfirmProjectId, setDeleteConfirmProjectId] = useState<string | null>(null);
  const [flagSecure, setFlagSecure] = useState<boolean>(() => isFlagSecureEnabled());

  // Enable device/browser back navigation to dismiss drawer smoothly
  useBackNavigation(isOpen, () => {
    stopPreview();
    onClose();
  }, "settings-drawer");

  // Keyboard Escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        stopPreview();
        onClose();
      }
    };
    const removeKey = safeAddEventListener("keydown", handleKeyDown);
    return () => removeKey();
  }, [isOpen, onClose]);

  useEffect(() => {
    setInputApiKey(customApiKey);
  }, [customApiKey]);

  useEffect(() => {
    setJulesInputKey(julesApiKey);
  }, [julesApiKey]);

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
    if (isBrowserEnvironment() && "speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
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
    if (isBrowserEnvironment() && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setPreviewingVoiceId(null);
    setIsPreviewLoading(false);
  };

  // Gemini API Key Actions
  const handleSaveApiKey = () => {
    onSaveCustomApiKey(inputApiKey.trim());
    setTestResult({
      success: true,
      message: "API Key updated successfully in local storage.",
    });
    setTimeout(() => setTestResult(null), 3500);
  };

  const handleClearApiKey = () => {
    setInputApiKey("");
    onSaveCustomApiKey("");
    setTestResult({
      success: true,
      message: "Custom Gemini API key removed.",
    });
    setTimeout(() => setTestResult(null), 3500);
  };

  const handlePasteApiKey = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputApiKey(text.trim());
      }
    } catch {
      // Clipboard access denied
    }
  };

  const handleTestKey = async (keyToTest?: string) => {
    setIsTestingKey(true);
    setTestResult(null);
    const key = keyToTest !== undefined ? keyToTest : inputApiKey.trim();

    try {
      const data = await fetchAuthStatus(key);

      if (data.valid) {
        setTestResult({
          success: true,
          message:
            data.authSource === "ai_studio_secret"
              ? "Verified! Google AI Studio environment authentication is connected and active."
              : "Verified! Your Gemini API key is valid and connected to live models.",
        });
        if (onRefreshServerAuth) onRefreshServerAuth();
      } else {
        setTestResult({
          success: false,
          message: data.error || "Authentication verification failed. Please check your key.",
        });
      }
    } catch {
      setTestResult({
        success: false,
        message: "Failed to connect to authentication verification service.",
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  // Jules API Key Actions
  const handleSaveJulesApiKey = () => {
    if (onSaveJulesApiKey) {
      onSaveJulesApiKey(julesInputKey.trim());
      setJulesTestResult({
        success: true,
        message: "Google Jules API Key saved successfully.",
      });
      setTimeout(() => setJulesTestResult(null), 3500);
    }
  };

  const handleClearJulesKey = () => {
    setJulesInputKey("");
    if (onSaveJulesApiKey) {
      onSaveJulesApiKey("");
      setJulesTestResult({
        success: true,
        message: "Google Jules API key removed.",
      });
      setTimeout(() => setJulesTestResult(null), 3500);
    }
  };

  const handlePasteJulesKey = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setJulesInputKey(text.trim());
      }
    } catch {
      // Clipboard access denied
    }
  };

  const handleTestJulesKey = async () => {
    setIsTestingJulesKey(true);
    setJulesTestResult(null);
    const key = julesInputKey.trim();

    try {
      const data = await verifyJulesApiKey(key);

      if (data.valid) {
        setJulesTestResult({
          success: true,
          message: "Verified! Your Google Jules API key is active and connected to GitHub tasks.",
        });
      } else {
        setJulesTestResult({
          success: false,
          message: data.error || "Google Jules key verification failed.",
        });
      }
    } catch (err: unknown) {
      setJulesTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Failed to verify Jules key.",
      });
    } finally {
      setIsTestingJulesKey(false);
    }
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
      if (!isBrowserEnvironment() || !("speechSynthesis" in window)) {
        setPreviewError("Device speech synthesis not available.");
        setPreviewingVoiceId(null);
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(samplePhrase);
      utterance.rate = currentSpeechSettings.playbackRate;

      const rawVoices = window.speechSynthesis.getVoices();
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

      window.speechSynthesis.speak(utterance);
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
              className="p-2 -ml-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer flex items-center gap-1.5 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title="Close drawer"
              aria-label="Back / Close drawer"
            >
              <ArrowLeft className="w-5 h-5" />
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
                <span className="absolute -top-1 -right-2 text-[10px] font-mono text-destructive font-bold" title="Authentication needed">
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
            <div className="space-y-4">
              {/* Google Account Authentication */}
              <GoogleAuthCard
                user={googleUser}
                onLogin={onGoogleLogin || (async () => {})}
                onLogout={onGoogleLogout || (async () => {})}
                liveModelsCount={liveModelsCount}
              />

              {/* Server Environment Connection Status */}
              <div
                className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
                  hasServerKey
                    ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
                    : "bg-card border-border text-muted-foreground"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 p-1.5 rounded-lg ${
                      hasServerKey
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">
                      AI Studio Cloud Environment
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {hasServerKey
                        ? "Server environment credentials are active. Requests are securely proxied."
                        : "No server environment key detected. You can supply a custom Gemini API key below."}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  id="test-env-auth-btn"
                  onClick={() => handleTestKey("")}
                  disabled={isTestingKey}
                  className="px-3 py-1.5 rounded-lg bg-card hover:bg-muted border border-border text-xs font-medium text-foreground shrink-0 transition-colors cursor-pointer"
                >
                  {isTestingKey ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Test Status"
                  )}
                </button>
              </div>

              {/* Workspace Projects Management Card */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary/15 border border-primary/30 text-primary">
                      <Folder className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">
                        Workspace Projects ({projects.length})
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Manage registered AI Studio projects and switch credentials.
                      </p>
                    </div>
                  </div>
                  {onOpenImportProject && (
                    <button
                      type="button"
                      id="settings-add-project-btn"
                      onClick={() => {
                        onClose();
                        onOpenImportProject();
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>+ New Project</span>
                    </button>
                  )}
                </div>

                {/* Projects List */}
                {projects.length === 0 ? (
                  <div className="p-3 text-center rounded-xl bg-muted border border-border text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">No Projects Registered</p>
                    <p className="text-[11px] text-muted-foreground">
                      Add a project or enter a custom key below to start prompting.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {projects.map((proj) => {
                      const isActive = activeProject?.id === proj.id;
                      const isEditing = editingProjectId === proj.id;
                      const isConfirmingDelete = deleteConfirmProjectId === proj.id;
                      const maskedKey = proj.apiKey
                        ? `${proj.apiKey.slice(0, 6)}••••••••${proj.apiKey.slice(-4)}`
                        : "No key stored";

                      return (
                        <div
                          key={proj.id}
                          id={`settings-project-card-${proj.id}`}
                          className={`p-3 rounded-xl border transition-colors ${
                            isActive
                              ? "bg-primary/15 border-primary shadow-sm"
                              : "bg-card border-border hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              {isEditing ? (
                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                  <input
                                    type="text"
                                    id={`input-rename-project-${proj.id}`}
                                    value={editingProjectName}
                                    onChange={(e) => setEditingProjectName(e.target.value)}
                                    className="px-2 py-1 text-xs bg-muted border border-primary rounded-md text-foreground focus:outline-none w-full max-w-[200px]"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        if (editingProjectName.trim()) {
                                          onRenameProject?.(proj.id, editingProjectName.trim());
                                        }
                                        setEditingProjectId(null);
                                      } else if (e.key === "Escape") {
                                        setEditingProjectId(null);
                                      }
                                    }}
                                  />
                                  <button
                                    type="button"
                                    id={`btn-save-rename-${proj.id}`}
                                    onClick={() => {
                                      if (editingProjectName.trim()) {
                                        onRenameProject?.(proj.id, editingProjectName.trim());
                                      }
                                      setEditingProjectId(null);
                                    }}
                                    className="px-2 py-1 text-xs bg-primary hover:bg-primary/90 text-primary-foreground rounded-md font-medium cursor-pointer"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingProjectId(null)}
                                    className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 text-foreground rounded-md cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h5 className="text-xs font-semibold text-foreground">
                                    {proj.name}
                                  </h5>
                                  {(!proj.isValid || proj.status === "invalid_key" || proj.status === "attention_required") ? (
                                    <span className="px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/30 text-[10px] font-medium flex items-center gap-1">
                                      <AlertTriangle className="w-2.5 h-2.5 text-destructive" />
                                      <span>Key Attention</span>
                                    </span>
                                  ) : isActive ? (
                                    <span className="px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 text-[10px] font-medium flex items-center gap-1">
                                      <CheckCircle2 className="w-2.5 h-2.5" />
                                      <span>Active</span>
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      id={`btn-set-active-${proj.id}`}
                                      onClick={() => onSelectProject?.(proj)}
                                      className="px-1.5 py-0.5 rounded-md bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border text-[10px] transition-colors font-medium cursor-pointer"
                                    >
                                      Set Active
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    id={`btn-edit-rename-${proj.id}`}
                                    onClick={() => {
                                      setEditingProjectId(proj.id);
                                      setEditingProjectName(proj.name);
                                    }}
                                    className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors cursor-pointer"
                                    title="Rename project"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}

                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-[11px] font-mono text-muted-foreground">
                                  {maskedKey}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-mono">
                                  {proj.defaultModel || "gemini-3.8-flash"}
                                </span>
                                {(!proj.isValid || proj.status === "invalid_key") && onOpenCustomTabBrowser && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onClose();
                                      onOpenCustomTabBrowser("aistudio");
                                    }}
                                    className="text-[10px] text-primary hover:underline font-medium cursor-pointer"
                                  >
                                    Update in AI Studio →
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Actions on Project */}
                            <div className="flex items-center gap-1 shrink-0">
                              {isConfirmingDelete ? (
                                <div className="flex items-center gap-1 bg-destructive/15 border border-destructive/30 p-1 rounded-lg">
                                  <span className="text-[10px] text-destructive font-medium px-1">
                                    Delete?
                                  </span>
                                  <button
                                    type="button"
                                    id={`btn-confirm-delete-${proj.id}`}
                                    onClick={() => {
                                      onDeleteProject?.(proj.id);
                                      setDeleteConfirmProjectId(null);
                                    }}
                                    className="px-1.5 py-0.5 text-[10px] bg-destructive text-destructive-foreground rounded font-medium transition-colors cursor-pointer"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmProjectId(null)}
                                    className="px-1.5 py-0.5 text-[10px] bg-muted hover:bg-muted/80 text-foreground rounded transition-colors cursor-pointer"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  id={`btn-delete-project-${proj.id}`}
                                  onClick={() => setDeleteConfirmProjectId(proj.id)}
                                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                                  title="Delete project"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Gemini Custom API Key Input Card */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-foreground block">
                      Custom Gemini API Key
                    </label>
                    {activeProjectName && (
                      <span className="text-[10px] text-muted-foreground block font-normal">
                        Active Project: <strong className="text-primary">{activeProjectName}</strong>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {onOpenCustomTabBrowser && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenCustomTabBrowser("aistudio");
                        }}
                        className="text-[11px] text-primary hover:underline flex items-center gap-1 transition-colors font-medium cursor-pointer"
                        title="Launch AI Studio in Chrome Custom Tab"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Get Key</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative">
                  <input
                    type={showKeyText ? "text" : "password"}
                    id="settings-custom-key-input"
                    value={inputApiKey}
                    onChange={(e) => setInputApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full text-xs font-mono bg-muted/50 border border-input rounded-xl px-3.5 py-2.5 pr-24 text-foreground placeholder:text-subtle-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handlePasteApiKey}
                      className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors cursor-pointer"
                      title="Paste from clipboard"
                    >
                      <ClipboardPaste className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowKeyText(!showKeyText)}
                      className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors cursor-pointer"
                      title={showKeyText ? "Hide key" : "Show key"}
                    >
                      {showKeyText ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => handleTestKey(inputApiKey)}
                    disabled={isTestingKey}
                    className="px-3 py-1.5 rounded-lg bg-card hover:bg-muted border border-border text-xs font-medium text-foreground flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isTestingKey ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    ) : (
                      <Check className="w-3.5 h-3.5 text-primary" />
                    )}
                    <span>Test Key</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {customApiKey && (
                      <button
                        type="button"
                        onClick={handleClearApiKey}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                    <button
                      type="button"
                      id="settings-save-key-btn"
                      onClick={handleSaveApiKey}
                      className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-md transition-colors active:scale-95 cursor-pointer"
                    >
                      Save Key
                    </button>
                  </div>
                </div>

                {testResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                      testResult.success
                        ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                        : "bg-destructive/15 border-destructive/30 text-destructive"
                    }`}
                  >
                    {testResult.success ? (
                      <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-destructive" />
                    )}
                    <span className="leading-relaxed">{testResult.message}</span>
                  </div>
                )}
              </div>

              {/* Google Jules Autonomous Agent Key Card */}
              <div className="p-4 rounded-xl border border-purple-500/30 bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">
                        Google Jules Autonomous Agent Key
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Required for autonomous GitHub coding tasks, PR creations, and code reviews.
                      </p>
                    </div>
                  </div>
                  {onOpenCustomTabBrowser && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenCustomTabBrowser("jules");
                      }}
                      className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors font-medium cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Jules Portal</span>
                    </button>
                  )}
                </div>

                <div className="relative">
                  <input
                    type={showJulesKeyText ? "text" : "password"}
                    id="settings-jules-key-input"
                    value={julesInputKey}
                    onChange={(e) => setJulesInputKey(e.target.value)}
                    placeholder="Enter Google Jules API Key..."
                    className="w-full text-xs font-mono bg-muted/50 border border-input rounded-xl px-3.5 py-2.5 pr-24 text-foreground placeholder:text-subtle-foreground focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handlePasteJulesKey}
                      className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors cursor-pointer"
                      title="Paste from clipboard"
                    >
                      <ClipboardPaste className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowJulesKeyText(!showJulesKeyText)}
                      className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors cursor-pointer"
                      title={showJulesKeyText ? "Hide key" : "Show key"}
                    >
                      {showJulesKeyText ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleTestJulesKey}
                    disabled={isTestingJulesKey}
                    className="px-3 py-1.5 rounded-lg bg-card hover:bg-muted border border-border text-xs font-medium text-foreground flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isTestingJulesKey ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                    ) : (
                      <Check className="w-3.5 h-3.5 text-purple-400" />
                    )}
                    <span>Test Jules Key</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {julesApiKey && (
                      <button
                        type="button"
                        onClick={handleClearJulesKey}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                    <button
                      type="button"
                      id="settings-save-jules-key-btn"
                      onClick={handleSaveJulesApiKey}
                      className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md transition-colors active:scale-95 cursor-pointer"
                    >
                      Save Jules Key
                    </button>
                  </div>
                </div>

                {julesTestResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                      julesTestResult.success
                        ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                        : "bg-destructive/15 border-destructive/30 text-destructive"
                    }`}
                  >
                    {julesTestResult.success ? (
                      <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-destructive" />
                    )}
                    <span className="leading-relaxed">{julesTestResult.message}</span>
                  </div>
                )}
              </div>

              {/* Native Android Application • Google Play Store Distribution Placeholder */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-semibold text-foreground">
                          Native Android Application
                        </h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary border border-primary/25">
                          Google Play
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        If you want the mobile native version with full system integration and background execution, download it directly from Google Play.
                      </p>
                    </div>
                  </div>

                  <a
                    href="https://play.google.com/store/apps/details?id=com.aistudio.mobile"
                    target="_blank"
                    rel="noopener noreferrer"
                    id="play-store-download-btn"
                    className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium shrink-0 transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <span>Get on Play Store</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
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
                    className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
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
                    className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
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
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
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
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
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
                  <div className="space-y-0.5 pr-2">
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
                  <div className="space-y-0.5 pr-2">
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
                  <div className="space-y-0.5 pr-2">
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
                      className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
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
                      className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
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
                <div className="p-3 rounded-xl bg-destructive/15 border border-destructive/30 text-xs text-destructive">
                  {previewError}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DISPLAY & APPEARANCE */}
          {activeTab === "display" && (
            <div className="space-y-5">
              {/* Theme Selection */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Theme Appearance
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setThemeMode("light")}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      themeMode === "light"
                        ? "bg-primary/20 border-primary ring-1 ring-primary"
                        : "bg-card border-border hover:border-primary/50 hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <Sun className="w-3.5 h-3.5 text-foreground" />
                        <span className="font-semibold text-xs text-foreground">Light</span>
                      </div>
                      {themeMode === "light" && (
                        <span className="w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[9px]">
                          <Check className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Minimal crisp high-contrast theme.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setThemeMode("dark")}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      themeMode === "dark"
                        ? "bg-primary/20 border-primary ring-1 ring-primary"
                        : "bg-card border-border hover:border-primary/50 hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <Moon className="w-3.5 h-3.5 text-foreground" />
                        <span className="font-semibold text-xs text-foreground">Dark</span>
                      </div>
                      {themeMode === "dark" && (
                        <span className="w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[9px]">
                          <Check className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      AI Studio deep 4-tier dark theme.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setThemeMode("system")}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      themeMode === "system"
                        ? "bg-primary/20 border-primary ring-1 ring-primary"
                        : "bg-card border-border hover:border-primary/50 hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <Monitor className="w-3.5 h-3.5 text-foreground" />
                        <span className="font-semibold text-xs text-foreground">System</span>
                      </div>
                      {themeMode === "system" && (
                        <span className="w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[9px]">
                          <Check className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Automatically matches your OS preference.
                    </p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Display View Mode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => onSelectDeviceMode("responsive")}
                    className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                      deviceMode === "responsive"
                        ? "bg-primary/20 border-primary ring-1 ring-primary"
                        : "bg-card border-border hover:border-primary/50 hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                        <Laptop className="w-4 h-4 text-primary" />
                        <span>Responsive Full</span>
                      </div>
                      {deviceMode === "responsive" && (
                        <span className="w-4 h-4 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[10px]">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Adapts fluidly to your full screen or preview window width.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectDeviceMode("pixel")}
                    className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                      deviceMode === "pixel"
                        ? "bg-primary/20 border-primary ring-1 ring-primary"
                        : "bg-card border-border hover:border-primary/50 hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                        <Smartphone className="w-4 h-4 text-primary" />
                        <span>Google Pixel 9</span>
                      </div>
                      {deviceMode === "pixel" && (
                        <span className="w-4 h-4 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[10px]">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Realistic Android mobile frame simulation with status bar and bezel.
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SECURITY & PRIVACY */}
          {activeTab === "security" && (
            <div className="space-y-4">
              {/* Window & Screen Security (FLAG_SECURE) */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-primary/20 text-primary">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">
                        Android Screen Protection (FLAG_SECURE)
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                        Obscures screen snapshots in Recent Apps / App Switcher to prevent sensitive API key leaks.
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    id="settings-flag-secure-toggle"
                    checked={flagSecure}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setFlagSecure(enabled);
                      setFlagSecureEnabled(enabled);
                    }}
                    className="w-4 h-4 rounded text-primary bg-muted border-border focus:ring-primary cursor-pointer"
                  />
                </div>
              </div>

              {/* Data Sovereignty & Store Policy Disclosure */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                  <span>Data Sovereignty & Privacy</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed font-normal">
                  Your API keys, prompts, and project configurations are stored locally on your device and never sent to external servers other than official Google AI Studio endpoints.
                </p>
                <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Client for Google AI Studio</span>
                  <span className="text-primary font-medium">Official Gemini API</span>
                </div>
              </div>
            </div>
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
