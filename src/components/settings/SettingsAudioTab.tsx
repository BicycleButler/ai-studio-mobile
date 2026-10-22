import React, { useState, useEffect, useRef } from "react";
import {
  Smartphone,
  Sparkles,
  Check,
  Square,
  Volume2,
  Radio,
  Loader2,
} from "lucide-react";
import {
  GEMINI_VOICES,
  SpeechSettings,
  DeviceVoiceOption,
  defaultSpeechVoicesService,
} from "../../services/speechVoices";
import { getSafeWindowSpeechSynthesis } from "../../utils/platform";

export interface SettingsAudioTabProps {
  currentSpeechSettings: SpeechSettings;
  handleSelectAudioEngine: (engine: "gemini" | "device") => void;
  handleSelectGeminiVoice: (id: string) => void;
  handleSelectDeviceVoice: (uri: string) => void;
  handleSelectRate: (rate: number) => void;
}

export const SettingsAudioTab: React.FC<SettingsAudioTabProps> = ({
  currentSpeechSettings,
  handleSelectAudioEngine,
  handleSelectGeminiVoice,
  handleSelectDeviceVoice,
  handleSelectRate,
}) => {
  const [deviceVoices, setDeviceVoices] = useState<DeviceVoiceOption[]>([]);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setDeviceVoices(defaultSpeechVoicesService.getAvailableDeviceVoices());
  }, []);

  const stopPreview = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
    const synth = getSafeWindowSpeechSynthesis();
    if (synth) {
      synth.cancel();
    }
    setPreviewingVoiceId(null);
    setIsPreviewLoading(false);
  };

  useEffect(() => {
    return () => {
      stopPreview();
    };
  }, []);

  const handlePreviewVoice = async (
    voiceId: string,
    engine: "gemini" | "device"
  ) => {
    // If already playing this voice, stop it.
    if (previewingVoiceId === voiceId) {
      stopPreview();
      return;
    }

    // Stop anything currently playing
    stopPreview();
    setPreviewingVoiceId(voiceId);

    const testPhrase = "Hello, I am ready to assist you. How does my voice sound?";

    if (engine === "gemini") {
      setIsPreviewLoading(true);
      try {
        const audioResponse = await defaultSpeechVoicesService.fetchTTSAudioUrl(testPhrase, voiceId);
        const audioUrl = audioResponse?.audioUrl;
        if (!audioUrl) throw new Error("Failed to load Gemini TTS preview.");

        const audio = new Audio(audioUrl);
        audio.playbackRate = currentSpeechSettings.playbackRate;
        previewAudioRef.current = audio;

        audio.onended = () => {
          setPreviewingVoiceId(null);
          setIsPreviewLoading(false);
        };
        audio.onerror = () => {
          console.error("Audio playback error");
          setPreviewingVoiceId(null);
          setIsPreviewLoading(false);
        };

        await audio.play();
        setIsPreviewLoading(false);
      } catch (err) {
        console.error("TTS Preview failed:", err);
        setPreviewingVoiceId(null);
        setIsPreviewLoading(false);
      }
    } else {
      // Device Engine Playback
      const synth = getSafeWindowSpeechSynthesis();
      if (!synth) {
        console.warn("SpeechSynthesis not supported on this platform.");
        setPreviewingVoiceId(null);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(testPhrase);
      const allVoices = synth.getVoices();
      const selectedVoice = allVoices.find((v) => v.voiceURI === voiceId);

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      utterance.rate = currentSpeechSettings.playbackRate;

      utterance.onend = () => {
        setPreviewingVoiceId(null);
      };
      utterance.onerror = (e) => {
        console.error("Device voice preview failed", e);
        setPreviewingVoiceId(null);
      };

      synth.speak(utterance);
    }
  };

  return (
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
                <span className="text-xs text-muted-foreground/70 font-medium ml-1.5">
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
                <span className="text-xs text-muted-foreground/70 font-medium ml-1.5">
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
    </div>
  );
};
