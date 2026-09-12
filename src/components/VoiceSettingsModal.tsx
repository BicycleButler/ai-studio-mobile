import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Sparkles,
  Cpu,
  Volume2,
  Square,
  Loader2,
  Check,
  Radio,
  Sliders,
} from "lucide-react";
import {
  GEMINI_VOICES,
  SpeechSettings,
  getAvailableDeviceVoices,
  DeviceVoiceOption,
} from "../services/speechVoices";
import { getAuthHeaders } from "../services/auth";

interface VoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SpeechSettings;
  onSaveSettings: (newSettings: SpeechSettings) => void;
}

export const VoiceSettingsModal: React.FC<VoiceSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [currentSettings, setCurrentSettings] = useState<SpeechSettings>(settings);
  const [deviceVoices, setDeviceVoices] = useState<DeviceVoiceOption[]>([]);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setCurrentSettings(settings);
  }, [settings]);

  // Load device voices when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadVoices = () => {
      const voices = getAvailableDeviceVoices();
      setDeviceVoices(voices);
      if (voices.length > 0 && !currentSettings.deviceVoiceURI) {
        // Default to the first (highest scored natural) voice
        setCurrentSettings((prev) => ({
          ...prev,
          deviceVoiceURI: voices[0].voiceURI,
        }));
      }
    };

    loadVoices();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [isOpen, currentSettings.deviceVoiceURI]);

  // Clean up audio on unmount or close
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
          throw new Error("No audio returned");
        }

        setIsPreviewLoading(false);
        const audio = new Audio(data.audioUrl);
        audio.playbackRate = currentSettings.playbackRate;
        previewAudioRef.current = audio;

        audio.onended = () => {
          setPreviewingVoiceId(null);
          previewAudioRef.current = null;
        };

        audio.onerror = () => {
          setPreviewingVoiceId(null);
          previewAudioRef.current = null;
          setPreviewError("Failed to play audio sample.");
        };

        await audio.play();
      } catch (err: unknown) {
        setIsPreviewLoading(false);
        setPreviewingVoiceId(null);
        setPreviewError(err instanceof Error ? err.message : "Error previewing Gemini voice.");
      }
    } else {
      // On-device synthesis preview
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        setPreviewError("Device speech synthesis not supported.");
        setPreviewingVoiceId(null);
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(samplePhrase);
      utterance.rate = currentSettings.playbackRate;

      const rawVoices = window.speechSynthesis.getVoices();
      const selectedVoice = rawVoices.find((v) => v.voiceURI === currentSettings.deviceVoiceURI);
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

  const handleSelectEngine = (engine: "gemini" | "device") => {
    stopPreview();
    const updated: SpeechSettings = { ...currentSettings, engine };
    setCurrentSettings(updated);
    onSaveSettings(updated);
  };

  const handleSelectGeminiVoice = (geminiVoice: string) => {
    const updated: SpeechSettings = { ...currentSettings, geminiVoice };
    setCurrentSettings(updated);
    onSaveSettings(updated);
  };

  const handleSelectDeviceVoice = (deviceVoiceURI: string) => {
    const updated: SpeechSettings = { ...currentSettings, deviceVoiceURI };
    setCurrentSettings(updated);
    onSaveSettings(updated);
  };

  const handleSelectRate = (playbackRate: number) => {
    const updated: SpeechSettings = { ...currentSettings, playbackRate };
    setCurrentSettings(updated);
    onSaveSettings(updated);
    if (previewAudioRef.current) {
      previewAudioRef.current.playbackRate = playbackRate;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="voice-settings-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          stopPreview();
          onClose();
        }
      }}
    >
      <div
        id="voice-settings-modal"
        className="relative w-full max-w-lg bg-[#1a1c24] border border-[#343846] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-zinc-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2d313e] bg-[#16171f]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Audio & Voice Settings</h3>
              <p className="text-xs text-zinc-400">
                Choose studio AI voices or on-device speech playback
              </p>
            </div>
          </div>
          <button
            type="button"
            id="voice-settings-close-btn"
            onClick={() => {
              stopPreview();
              onClose();
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Engine Selection */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
              Speech Playback Engine
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Gemini Engine Card */}
              <button
                type="button"
                id="engine-select-gemini"
                onClick={() => handleSelectEngine("gemini")}
                className={`p-3.5 rounded-xl border text-left transition-colors relative ${
                  currentSettings.engine === "gemini"
                    ? "bg-blue-950/40 border-blue-500 shadow-sm shadow-blue-500/10 ring-1 ring-blue-500"
                    : "bg-[#21242f]/80 border-[#343846] hover:border-zinc-500 hover:bg-[#262a37]"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-sm text-zinc-100">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    <span>Gemini AI Studio</span>
                  </div>
                  {currentSettings.engine === "gemini" && (
                    <span className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px]">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Studio-grade neural voices with natural inflection and human cadence.
                </p>
                <span className="inline-block mt-2 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Ultra HD Quality
                </span>
              </button>

              {/* Device Engine Card */}
              <button
                type="button"
                id="engine-select-device"
                onClick={() => handleSelectEngine("device")}
                className={`p-3.5 rounded-xl border text-left transition-colors relative ${
                  currentSettings.engine === "device"
                    ? "bg-blue-950/40 border-blue-500 shadow-sm shadow-blue-500/10 ring-1 ring-blue-500"
                    : "bg-[#21242f]/80 border-[#343846] hover:border-zinc-500 hover:bg-[#262a37]"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-sm text-zinc-100">
                    <Cpu className="w-4 h-4 text-blue-400" />
                    <span>Device System</span>
                  </div>
                  {currentSettings.engine === "device" && (
                    <span className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px]">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  On-device browser speech synthesis. Instant start and operates offline.
                </p>
                <span className="inline-block mt-2 px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted/60 text-zinc-300 border border-border/40 font-mono">
                  Zero Latency
                </span>
              </button>
            </div>
          </div>

          {/* Voice Personality Selection */}
          {currentSettings.engine === "gemini" ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Gemini AI Voice Persona
                </label>
                <span className="text-[11px] text-blue-400 font-medium">
                  Model: gemini-3.1-flash-tts-preview
                </span>
              </div>
              <div className="space-y-2">
                {GEMINI_VOICES.map((v) => {
                  const isSelected = currentSettings.geminiVoice === v.id;
                  const isPlaying = previewingVoiceId === v.id;

                  return (
                    <div
                      key={v.id}
                      onClick={() => handleSelectGeminiVoice(v.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-blue-950/30 border-blue-500/80 shadow-sm shadow-blue-500/5 ring-1 ring-blue-500/40"
                          : "bg-[#21242f]/60 border-[#313543] hover:border-zinc-500 hover:bg-[#262a37]"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-xs text-zinc-100">{v.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono">
                            {v.gender}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400">{v.personality || v.description}</p>
                      </div>

                      {/* Audition Button */}
                      <button
                        type="button"
                        id={`audition-gemini-voice-${v.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreviewVoice(v.id, "gemini");
                        }}
                        className={`p-2 rounded-lg border text-xs font-medium shrink-0 flex items-center gap-1.5 transition-colors ${
                          isPlaying
                            ? "bg-blue-600 border-blue-400 text-white shadow-md"
                            : "bg-[#282c39] border-[#3e4456] text-zinc-300 hover:text-white hover:border-blue-400"
                        }`}
                        title={`Audition ${v.name} sample`}
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
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Device System Voice
                </label>
                <span className="text-[11px] text-zinc-400">
                  {deviceVoices.length} voices installed
                </span>
              </div>

              {deviceVoices.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#21242f] border border-[#343846] text-xs text-zinc-300">
                  No system voices reported by the browser yet. Browser default will be used.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {deviceVoices.slice(0, 15).map((v) => {
                    const isSelected = currentSettings.deviceVoiceURI === v.voiceURI;
                    const isPlaying = previewingVoiceId === v.voiceURI;

                    return (
                      <div
                        key={v.voiceURI}
                        onClick={() => handleSelectDeviceVoice(v.voiceURI)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-blue-950/30 border-blue-500/80 ring-1 ring-blue-500/40"
                            : "bg-[#21242f]/60 border-[#313543] hover:border-zinc-500 hover:bg-[#262a37]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <Radio
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isSelected ? "text-blue-400 fill-blue-400" : "text-zinc-500"
                            }`}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-xs text-zinc-200 truncate">
                                {v.name}
                              </span>
                              {v.isNatural && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-muted/60 text-zinc-300 border border-border/40 font-mono">
                                  Natural
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-zinc-400">{v.lang}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          id={`audition-device-voice-${v.voiceURI.slice(0, 10)}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreviewVoice(v.voiceURI, "device");
                          }}
                          className={`p-1.5 rounded-lg border text-[11px] font-medium shrink-0 flex items-center gap-1 transition-colors ${
                            isPlaying
                              ? "bg-blue-600 border-blue-400 text-white"
                              : "bg-[#282c39] border-[#3e4456] text-zinc-300 hover:text-white"
                          }`}
                          title="Audition voice"
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
              )}
            </div>
          )}

          {/* Speed Selection */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
              Speech Rate
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[0.8, 1.0, 1.25, 1.5].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  id={`rate-btn-${rate}`}
                  onClick={() => handleSelectRate(rate)}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-colors ${
                    currentSettings.playbackRate === rate
                      ? "bg-blue-600 border-blue-400 text-white shadow-sm shadow-blue-500/20 ring-2 ring-blue-500/20"
                      : "bg-[#21242f] border-[#343846] text-zinc-300 hover:text-white hover:bg-[#292e3c]"
                  }`}
                >
                  {rate === 1.0 ? "1.0x (Normal)" : `${rate}x`}
                </button>
              ))}
            </div>
          </div>

          {/* Feedback / Error state */}
          {previewError && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-300">
              {previewError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[#2d313e] bg-[#16171f] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-300 bg-muted/60 px-1.5 py-0.5 rounded border border-border/40">
              Ready
            </span>
            <span className="text-xs text-zinc-400">
              Active:{" "}
              <strong className="text-zinc-200">
                {currentSettings.engine === "gemini"
                  ? `${currentSettings.geminiVoice} (AI Studio HD)`
                  : "On-Device Natural Voice"}
              </strong>
            </span>
          </div>

          <button
            type="button"
            id="voice-settings-done-btn"
            onClick={() => {
              stopPreview();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors shadow-md active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
