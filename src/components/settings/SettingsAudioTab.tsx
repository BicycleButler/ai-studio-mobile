import React from "react";
import {
  Smartphone,
  Sparkles,
  Check,
  Radio,
} from "lucide-react";
import {
  GEMINI_VOICES,
  SpeechSettings,
  DeviceVoiceOption,
} from "../../services/speechVoices";
import { useServices } from "../../services/ServiceContext";

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
  const { speechVoicesService } = useServices();
  const [deviceVoices, setDeviceVoices] = React.useState<DeviceVoiceOption[]>([]);

  React.useEffect(() => {
    const voices = speechVoicesService.getAvailableDeviceVoices();
    setDeviceVoices(voices);
  }, [speechVoicesService]);





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
