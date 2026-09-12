import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Key,
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
  RotateCcw,
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
import {
  GEMINI_VOICES,
  SpeechSettings,
  getAvailableDeviceVoices,
  DeviceVoiceOption,
} from "../services/speechVoices";
import { getAuthHeaders } from "../services/auth";
import { LibraryModal } from "./LibraryModal";
import { CodeExportModal } from "./CodeExportModal";
import { DesktopWrapperGuide } from "./DesktopWrapperGuide";
import { isFlagSecureEnabled, setFlagSecureEnabled } from "../utils/storage";

export type SettingsTab =
  | "tune"
  | "library"
  | "export"
  | "companion"
  | "audio"
  | "auth"
  | "display"
  | "model";

interface UnifiedSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;

  // Auth props
  customApiKey: string;
  onSaveCustomApiKey: (key: string) => void;
  hasServerKey: boolean;
  onRefreshServerAuth?: () => void;
  googleUser?: GoogleUser | null;
  onGoogleLogin?: (email?: string, name?: string) => Promise<void>;
  onGoogleLogout?: () => Promise<void>;
  liveModelsCount?: number;
  onOpenCustomTabBrowser?: () => void;
  onOpenImportProject?: () => void;
  activeProjectName?: string;
  projects?: ProjectInfo[];
  activeProject?: ProjectInfo | null;
  onSelectProject?: (project: ProjectInfo) => void;
  onRenameProject?: (id: string, newName: string) => void;
  onDeleteProject?: (id: string) => void;

  // Audio props
  speechSettings: SpeechSettings;
  onSaveSpeechSettings: (newSettings: SpeechSettings) => void;

  // Model & Tuner props
  config: PromptConfig;
  onChangeConfig: (newConfig: PromptConfig) => void;
  models: ModelInfo[];

  // Library props
  savedPrompts?: SavedPrompt[];
  onLoadPrompt?: (prompt: SavedPrompt) => void;
  onSaveCurrentPrompt?: (title: string) => void;
  onDeletePrompt?: (id: string) => void;

  // Export props
  messages?: ChatMessage[];

  // Display props
  deviceMode: DeviceFrameMode;
  onSelectDeviceMode: (mode: DeviceFrameMode) => void;
}

export const UnifiedSettingsModal: React.FC<UnifiedSettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = "tune",
  customApiKey,
  onSaveCustomApiKey,
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
  config,
  onChangeConfig,
  models,
  savedPrompts = [],
  onLoadPrompt,
  onSaveCurrentPrompt,
  onDeletePrompt,
  messages = [],
  deviceMode,
  onSelectDeviceMode,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  // Sync initial tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Auth & Project state
  const [inputApiKey, setInputApiKey] = useState(customApiKey);
  const [showKeyText, setShowKeyText] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const [deleteConfirmProjectId, setDeleteConfirmProjectId] = useState<string | null>(null);
  const [flagSecure, setFlagSecure] = useState<boolean>(() => isFlagSecureEnabled());

  useEffect(() => {
    setInputApiKey(customApiKey);
  }, [customApiKey]);

  // Audio state
  const [currentSpeechSettings, setCurrentSpeechSettings] =
    useState<SpeechSettings>(speechSettings);
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
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
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
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setPreviewingVoiceId(null);
    setIsPreviewLoading(false);
  };

  // Auth Actions
  const handleSaveApiKey = () => {
    onSaveCustomApiKey(inputApiKey.trim());
    setTestResult({
      success: true,
      message: "API Key updated successfully.",
    });
    setTimeout(() => setTestResult(null), 3500);
  };

  const handleClearApiKey = () => {
    setInputApiKey("");
    onSaveCustomApiKey("");
    setTestResult({
      success: true,
      message: "Custom API key removed.",
    });
    setTimeout(() => setTestResult(null), 3500);
  };

  const handleTestKey = async (keyToTest?: string) => {
    setIsTestingKey(true);
    setTestResult(null);
    const key = keyToTest !== undefined ? keyToTest : inputApiKey.trim();

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (key) {
        headers["x-gemini-api-key"] = key;
      }

      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers,
      });

      const data = (await res.json()) as {
        valid?: boolean;
        error?: string;
        authSource?: string;
      };

      if (res.ok && data.valid) {
        setTestResult({
          success: true,
          message:
            data.authSource === "ai_studio_secret"
              ? "Verified! Google AI Studio environment authentication is connected and active."
              : "Verified! Your Gemini API key is valid and connected.",
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
        const authHeaders = getAuthHeaders();
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({
            text: samplePhrase,
            voiceName,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }

        const data = await res.json();
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
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
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

  // Model & Tuner Helpers
  const updateConfigField = <K extends keyof PromptConfig>(
    field: K,
    value: PromptConfig[K]
  ) => {
    onChangeConfig({ ...config, [field]: value });
  };

  const handleResetTuners = () => {
    onChangeConfig({
      ...config,
      temperature: 1.0,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 2048,
    });
  };

  if (!isOpen) return null;

  const hasAnyAuth = Boolean(googleUser || customApiKey.trim() || hasServerKey);

  return (
    <div
      id="unified-settings-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          stopPreview();
          onClose();
        }
      }}
    >
      <div
        id="unified-settings-dialog"
        className="relative w-full max-w-2xl bg-[#1a1c24] border border-[#343846] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-zinc-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2d313e] bg-[#16171f]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Menu & Settings</h3>
              <p className="text-xs text-zinc-400">
                Tune parameters, saved prompts library, export code, and app configurations
              </p>
            </div>
          </div>
          <button
            type="button"
            id="settings-modal-close-btn"
            onClick={() => {
              stopPreview();
              onClose();
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Close Settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#2d313e] bg-[#171922] px-3 overflow-x-auto scrollbar-none">
          <button
            type="button"
            id="tab-btn-tune"
            onClick={() => {
              stopPreview();
              setActiveTab("tune");
            }}
            className={`flex items-center gap-1.5 py-3 px-3 text-xs font-semibold border-b-2 transition-all shrink-0 ${
              activeTab === "tune" || activeTab === "model"
                ? "border-blue-500 text-blue-400 bg-blue-500/5"
                : "border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Tune</span>
          </button>

          <button
            type="button"
            id="tab-btn-library"
            onClick={() => {
              stopPreview();
              setActiveTab("library");
            }}
            className={`flex items-center gap-1.5 py-3 px-3 text-xs font-semibold border-b-2 transition-all shrink-0 ${
              activeTab === "library"
                ? "border-blue-500 text-blue-400 bg-blue-500/5"
                : "border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
            }`}
          >
            <FolderHeart className="w-3.5 h-3.5" />
            <span>Library</span>
          </button>

          <button
            type="button"
            id="tab-btn-export"
            onClick={() => {
              stopPreview();
              setActiveTab("export");
            }}
            className={`flex items-center gap-1.5 py-3 px-3 text-xs font-semibold border-b-2 transition-all shrink-0 ${
              activeTab === "export"
                ? "border-blue-500 text-blue-400 bg-blue-500/5"
                : "border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Get Code</span>
          </button>

          <button
            type="button"
            id="tab-btn-companion"
            onClick={() => {
              stopPreview();
              setActiveTab("companion");
            }}
            className={`flex items-center gap-1.5 py-3 px-3 text-xs font-semibold border-b-2 transition-all shrink-0 ${
              activeTab === "companion"
                ? "border-blue-500 text-blue-400 bg-blue-500/5"
                : "border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Companion</span>
          </button>

          <button
            type="button"
            id="tab-btn-audio"
            onClick={() => {
              stopPreview();
              setActiveTab("audio");
            }}
            className={`flex items-center gap-1.5 py-3 px-3 text-xs font-semibold border-b-2 transition-all shrink-0 ${
              activeTab === "audio"
                ? "border-blue-500 text-blue-400 bg-blue-500/5"
                : "border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Audio</span>
          </button>

          <button
            type="button"
            id="tab-btn-auth"
            onClick={() => {
              stopPreview();
              setActiveTab("auth");
            }}
            className={`flex items-center gap-1.5 py-3 px-3 text-xs font-semibold border-b-2 transition-all shrink-0 ${
              activeTab === "auth"
                ? "border-blue-500 text-blue-400 bg-blue-500/5"
                : "border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Auth</span>
            {!hasAnyAuth && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            )}
          </button>

          <button
            type="button"
            id="tab-btn-display"
            onClick={() => {
              stopPreview();
              setActiveTab("display");
            }}
            className={`flex items-center gap-1.5 py-3 px-3 text-xs font-semibold border-b-2 transition-all shrink-0 ${
              activeTab === "display"
                ? "border-blue-500 text-blue-400 bg-blue-500/5"
                : "border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>Display</span>
          </button>
        </div>

        {/* Scrollable Tab Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {/* TAB 1: AUTHENTICATION */}
          {activeTab === "auth" && (
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
                    : "bg-[#21242f]/70 border-[#333746] text-zinc-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 p-1.5 rounded-lg ${
                      hasServerKey
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-100">
                      AI Studio Cloud Environment
                    </h4>
                    <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                      {hasServerKey
                        ? "Server environment authentication is active. Calls to Gemini API are securely proxied."
                        : "No server environment key detected. You can supply a custom Gemini API key below."}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  id="test-env-auth-btn"
                  onClick={() => handleTestKey("")}
                  disabled={isTestingKey}
                  className="px-3 py-1.5 rounded-lg bg-[#282c39] hover:bg-[#343a4b] border border-[#3e4456] text-xs font-medium text-zinc-200 shrink-0 transition-colors"
                >
                  {isTestingKey ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Test Status"
                  )}
                </button>
              </div>

              {/* Workspace Projects Management Card */}
              <div className="p-4 rounded-xl border border-[#333746] bg-[#21242f]/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400">
                      <Folder className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-200">
                        Workspace Projects ({projects.length})
                      </h4>
                      <p className="text-[11px] text-zinc-400">
                        Manage registered Google AI Studio projects and switch credentials.
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
                      className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 hover:text-amber-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>+ New Project</span>
                    </button>
                  )}
                </div>

                {/* Projects List */}
                {projects.length === 0 ? (
                  <div className="p-3.5 text-center rounded-xl bg-[#171922] border border-[#2b2f3d] text-xs text-zinc-400 space-y-1">
                    <p className="font-medium text-zinc-300">No Projects Registered</p>
                    <p className="text-[11px] text-zinc-500">
                      Import an AI Studio key to isolate conversation drafts and switch effortlessly.
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
                          className={`p-3 rounded-xl border transition-all ${
                            isActive
                              ? "bg-[#1c2233] border-blue-500/40 shadow-sm"
                              : "bg-[#181a24] border-[#2c303f] hover:border-[#3a4054]"
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
                                    className="px-2 py-1 text-xs bg-[#12131a] border border-blue-500/60 rounded-md text-white focus:outline-none w-full max-w-[200px]"
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
                                    className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-md font-medium"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingProjectId(null)}
                                    className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h5 className="text-xs font-semibold text-zinc-100">
                                    {proj.name}
                                  </h5>
                                  {(!proj.isValid || proj.status === "invalid_key" || proj.status === "attention_required") ? (
                                    <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-medium flex items-center gap-1">
                                      <AlertTriangle className="w-2.5 h-2.5" />
                                      <span>Key Expired</span>
                                    </span>
                                  ) : isActive ? (
                                    <span className="px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-medium flex items-center gap-1">
                                      <CheckCircle2 className="w-2.5 h-2.5" />
                                      <span>Active</span>
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      id={`btn-set-active-${proj.id}`}
                                      onClick={() => onSelectProject?.(proj)}
                                      className="px-1.5 py-0.5 rounded-md bg-[#252a38] hover:bg-blue-600/20 text-zinc-400 hover:text-blue-300 border border-[#373d50] text-[10px] transition-colors font-medium"
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
                                    className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded transition-colors"
                                    title="Rename project"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}

                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-[11px] font-mono text-zinc-400">
                                  {maskedKey}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-zinc-400 border border-zinc-700/50">
                                  {proj.defaultModel || "gemini-2.5-flash"}
                                </span>
                                {(!proj.isValid || proj.status === "invalid_key") && onOpenCustomTabBrowser && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onClose();
                                      onOpenCustomTabBrowser();
                                    }}
                                    className="text-[10px] text-amber-400 hover:text-amber-300 underline font-medium"
                                  >
                                    Update in AI Studio →
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Actions on Project */}
                            <div className="flex items-center gap-1 shrink-0">
                              {isConfirmingDelete ? (
                                <div className="flex items-center gap-1 bg-rose-950/40 border border-rose-500/40 p-1 rounded-lg">
                                  <span className="text-[10px] text-rose-300 font-medium px-1">
                                    Delete?
                                  </span>
                                  <button
                                    type="button"
                                    id={`btn-confirm-delete-${proj.id}`}
                                    onClick={() => {
                                      onDeleteProject?.(proj.id);
                                      setDeleteConfirmProjectId(null);
                                    }}
                                    className="px-1.5 py-0.5 text-[10px] bg-rose-600 hover:bg-rose-500 text-white rounded font-medium transition-colors"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmProjectId(null)}
                                    className="px-1.5 py-0.5 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  id={`btn-delete-project-${proj.id}`}
                                  onClick={() => setDeleteConfirmProjectId(proj.id)}
                                  className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20 rounded-lg transition-colors"
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

              {/* Custom API Key Input */}
              <div className="p-4 rounded-xl border border-[#333746] bg-[#21242f]/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-zinc-200 block">
                      Custom Gemini API Key
                    </label>
                    {activeProjectName && (
                      <span className="text-[10px] text-zinc-400 block font-normal">
                        Active Project: <strong className="text-blue-400">{activeProjectName}</strong>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {onOpenCustomTabBrowser && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenCustomTabBrowser();
                        }}
                        className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors font-medium"
                        title="Launch AI Studio in Chrome Custom Tab"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>In-App Tab</span>
                      </button>
                    )}
                    {onOpenImportProject && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenImportProject();
                        }}
                        className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors font-medium"
                      >
                        <span>+ Project</span>
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
                    className="w-full text-xs font-mono bg-[#16171f] border border-[#343846] rounded-xl px-3.5 py-2.5 pr-20 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowKeyText(!showKeyText)}
                      className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-md hover:bg-zinc-800 transition-colors"
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
                    className="px-3 py-1.5 rounded-lg bg-[#282c39] hover:bg-[#343a4b] border border-[#3e4456] text-xs font-medium text-zinc-200 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {isTestingKey ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                    ) : (
                      <Check className="w-3.5 h-3.5 text-blue-400" />
                    )}
                    <span>Test Key</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {customApiKey && (
                      <button
                        type="button"
                        onClick={handleClearApiKey}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                    <button
                      type="button"
                      id="settings-save-key-btn"
                      onClick={handleSaveApiKey}
                      className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-all active:scale-95"
                    >
                      Save Key
                    </button>
                  </div>
                </div>
              </div>

              {/* Feedback result */}
              {testResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                    testResult.success
                      ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                      : "bg-rose-950/30 border-rose-500/40 text-rose-300"
                  }`}
                >
                  {testResult.success ? (
                    <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  )}
                  <span className="leading-relaxed">{testResult.message}</span>
                </div>
              )}

              {/* Window & Screen Security (FLAG_SECURE) */}
              <div className="p-4 rounded-xl border border-[#333746] bg-[#21242f]/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-100">
                        Android Screen Protection (FLAG_SECURE)
                      </h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                        Obscures screen snapshots in Recent Apps / App Switcher to prevent sensitive API key and draft leaks.
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
                    className="w-4 h-4 rounded text-blue-600 bg-zinc-800 border-zinc-700 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Permanent Data Sovereignty & Store Policy Disclosure */}
              <div className="p-4 rounded-xl border border-[#2b2e3b] bg-[#171821] space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Data Sovereignty & Privacy Notice</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed font-normal">
                  Your API keys, prompts, and project configurations are encrypted locally and never transmitted to any third-party or intermediary server. All requests are routed directly to Google Generative AI endpoints.
                </p>
                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Client for Google AI Studio</span>
                  <span className="text-blue-400 font-medium">Powered by Google Gemini API</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AUDIO & VOICE */}
          {activeTab === "audio" && (
            <div className="space-y-4">
              {/* Engine Picker */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                  Voice Engine
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    id="settings-engine-gemini"
                    onClick={() => handleSelectAudioEngine("gemini")}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      currentSpeechSettings.engine === "gemini"
                        ? "bg-blue-950/40 border-blue-500 ring-1 ring-blue-500"
                        : "bg-[#21242f]/80 border-[#343846] hover:border-zinc-500 hover:bg-[#262a37]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 font-semibold text-sm text-zinc-100">
                        <Sparkles className="w-4 h-4 text-blue-400" />
                        <span>Gemini AI Studio</span>
                      </div>
                      {currentSpeechSettings.engine === "gemini" && (
                        <span className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px]">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400">
                      Studio-grade neural voices with natural inflection and human cadence.
                    </p>
                  </button>

                  <button
                    type="button"
                    id="settings-engine-device"
                    onClick={() => handleSelectAudioEngine("device")}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      currentSpeechSettings.engine === "device"
                        ? "bg-blue-950/40 border-blue-500 ring-1 ring-blue-500"
                        : "bg-[#21242f]/80 border-[#343846] hover:border-zinc-500 hover:bg-[#262a37]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 font-semibold text-sm text-zinc-100">
                        <Smartphone className="w-4 h-4 text-emerald-400" />
                        <span>Device System</span>
                      </div>
                      {currentSpeechSettings.engine === "device" && (
                        <span className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px]">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400">
                      On-device browser speech synthesis. Instant start and operates offline.
                    </p>
                  </button>
                </div>
              </div>

              {/* Gemini Voice Persona List */}
              {currentSpeechSettings.engine === "gemini" ? (
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                    Gemini AI Voice Persona (gemini-3.1-flash-tts-preview)
                  </label>
                  <div className="space-y-2">
                    {GEMINI_VOICES.map((v) => {
                      const isSelected = currentSpeechSettings.geminiVoice === v.id;
                      const isPlaying = previewingVoiceId === v.id;

                      return (
                        <div
                          key={v.id}
                          onClick={() => handleSelectGeminiVoice(v.id)}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? "bg-blue-950/30 border-blue-500/80 ring-1 ring-blue-500/40"
                              : "bg-[#21242f]/60 border-[#313543] hover:border-zinc-500 hover:bg-[#262a37]"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? "border-blue-500 bg-blue-500 text-white"
                                  : "border-zinc-500 bg-transparent"
                              }`}
                            >
                              {isSelected && (
                                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-zinc-100">
                                  {v.name}
                                </span>
                                <span className="text-[10px] text-zinc-400">
                                  {v.personality}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-400 mt-0.5">
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
                            className={`p-2 rounded-lg border text-xs font-medium shrink-0 flex items-center gap-1.5 transition-all ${
                              isPlaying
                                ? "bg-blue-600 border-blue-400 text-white"
                                : "bg-[#282c39] border-[#3e4456] text-zinc-300 hover:text-white hover:border-blue-400"
                            }`}
                            title={`Audition ${v.name}`}
                          >
                            {isPlaying ? (
                              <>
                                <Square className="w-3 h-3 fill-white" />
                                <span>Stop</span>
                              </>
                            ) : isPreviewLoading && previewingVoiceId === v.id ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                                <span>Loading</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3.5 h-3.5 text-blue-400" />
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
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
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
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? "bg-blue-950/30 border-blue-500/80 ring-1 ring-blue-500/40"
                              : "bg-[#21242f]/60 border-[#313543] hover:border-zinc-500 hover:bg-[#262a37]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <Radio
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isSelected
                                  ? "text-blue-400 fill-blue-400"
                                  : "text-zinc-500"
                              }`}
                            />
                            <div className="min-w-0">
                              <span className="font-medium text-xs text-zinc-200 truncate block">
                                {v.name}
                              </span>
                              <span className="text-[10px] text-zinc-400">
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
                            className="p-1.5 rounded-lg border border-[#3e4456] bg-[#282c39] text-zinc-300 hover:text-white"
                          >
                            {isPlaying ? (
                              <Square className="w-3 h-3 fill-white" />
                            ) : (
                              <Volume2 className="w-3 h-3 text-blue-400" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Speed rate */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                  Playback Speed
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[0.8, 1.0, 1.25, 1.5].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => handleSelectRate(rate)}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                        currentSpeechSettings.playbackRate === rate
                          ? "bg-blue-600 border-blue-400 text-white shadow-sm"
                          : "bg-[#21242f] border-[#343846] text-zinc-300 hover:text-white hover:bg-[#292e3c]"
                      }`}
                    >
                      {rate === 1.0 ? "1.0x (Normal)" : `${rate}x`}
                    </button>
                  ))}
                </div>
              </div>

              {previewError && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-300">
                  {previewError}
                </div>
              )}
            </div>
          )}

          {/* TAB: MODEL & TUNERS (TUNE) */}
          {(activeTab === "model" || activeTab === "tune") && (
            <div className="space-y-4">
              {/* Model Picker */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                  Active Gemini Model
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {models.map((m) => {
                    const isSelected = config.model === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => updateConfigField("model", m.id)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected
                            ? "bg-blue-950/40 border-blue-500 ring-1 ring-blue-500"
                            : "bg-[#21242f]/70 border-[#343846] hover:border-zinc-500 hover:bg-[#262a37]"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-xs text-zinc-100">
                            {m.name}
                          </span>
                          {isSelected && (
                            <span className="w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center text-white text-[9px]">
                              <Check className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2">
                          {m.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Temperature */}
              <div className="p-3.5 rounded-xl border border-[#343846] bg-[#21242f]/50 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-200">Temperature</span>
                  <span className="font-mono text-blue-400 font-semibold">
                    {config.temperature}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={config.temperature}
                  onChange={(e) =>
                    updateConfigField("temperature", parseFloat(e.target.value))
                  }
                  className="w-full accent-blue-500 h-1.5 bg-[#16171f] rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>Deterministic (0.0)</span>
                  <span>Creative (2.0)</span>
                </div>
              </div>

              {/* Top P & Top K */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border border-[#343846] bg-[#21242f]/50 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-200">Top P</span>
                    <span className="font-mono text-blue-400">{config.topP}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={config.topP}
                    onChange={(e) =>
                      updateConfigField("topP", parseFloat(e.target.value))
                    }
                    className="w-full accent-blue-500 h-1.5 bg-[#16171f] rounded-lg cursor-pointer"
                  />
                </div>

                <div className="p-3 rounded-xl border border-[#343846] bg-[#21242f]/50 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-200">Top K</span>
                    <span className="font-mono text-blue-400">{config.topK}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    value={config.topK}
                    onChange={(e) =>
                      updateConfigField("topK", parseInt(e.target.value, 10))
                    }
                    className="w-full accent-blue-500 h-1.5 bg-[#16171f] rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* Max Output Tokens */}
              <div className="p-3.5 rounded-xl border border-[#343846] bg-[#21242f]/50 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-200">Max Output Tokens</span>
                  <span className="font-mono text-blue-400">{config.maxOutputTokens}</span>
                </div>
                <input
                  type="range"
                  min="64"
                  max="8192"
                  step="64"
                  value={config.maxOutputTokens}
                  onChange={(e) =>
                    updateConfigField("maxOutputTokens", parseInt(e.target.value, 10))
                  }
                  className="w-full accent-blue-500 h-1.5 bg-[#16171f] rounded-lg cursor-pointer"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleResetTuners}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#3e4456] bg-[#282c39] text-xs text-zinc-300 hover:text-white transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset to Defaults</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB: PROMPT LIBRARY & TEMPLATES */}
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

          {/* TAB: GET CODE */}
          {activeTab === "export" && (
            <div className="space-y-4">
              <CodeExportModal
                config={config}
                messages={messages}
                isEmbedded={true}
              />
            </div>
          )}

          {/* TAB: COMPANION */}
          {activeTab === "companion" && (
            <div className="space-y-4">
              <DesktopWrapperGuide
                onOpenApiKeyModal={() => setActiveTab("auth")}
                isEmbedded={true}
              />
            </div>
          )}

          {/* TAB: DISPLAY & FRAME */}
          {activeTab === "display" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                  Display View Mode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => onSelectDeviceMode("responsive")}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      deviceMode === "responsive"
                        ? "bg-blue-950/40 border-blue-500 ring-1 ring-blue-500"
                        : "bg-[#21242f]/80 border-[#343846] hover:border-zinc-500 hover:bg-[#262a37]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-sm text-zinc-100">
                        <Laptop className="w-4 h-4 text-blue-400" />
                        <span>Responsive Full</span>
                      </div>
                      {deviceMode === "responsive" && (
                        <span className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px]">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Adapts fluidly to your full screen or preview window width.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectDeviceMode("pixel")}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      deviceMode === "pixel"
                        ? "bg-blue-950/40 border-blue-500 ring-1 ring-blue-500"
                        : "bg-[#21242f]/80 border-[#343846] hover:border-zinc-500 hover:bg-[#262a37]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-sm text-zinc-100">
                        <Smartphone className="w-4 h-4 text-emerald-400" />
                        <span>Google Pixel 9</span>
                      </div>
                      {deviceMode === "pixel" && (
                        <span className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px]">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Realistic Android mobile frame simulation with status bar and bezel.
                    </p>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-[#343846] bg-[#21242f]/50 text-xs text-zinc-400 space-y-1">
                <span className="font-semibold text-zinc-200 block">Workspace Cleanliness</span>
                <p>
                  Superfluous badges and pills have been streamlined to maintain a focused, high-contrast interface. All controls are accessible anytime from this Settings menu.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#2d313e] bg-[#16171f] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span
              className={`w-2 h-2 rounded-full ${
                hasAnyAuth ? "bg-emerald-400" : "bg-amber-400"
              }`}
            />
            <span>
              {hasAnyAuth
                ? "AI Studio Connected"
                : "Authentication Required"}
            </span>
          </div>

          <button
            type="button"
            id="settings-done-btn"
            onClick={() => {
              stopPreview();
              onClose();
            }}
            className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md active:scale-95 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
