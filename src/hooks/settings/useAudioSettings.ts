import { useState, useRef, useEffect } from "react";
import { SpeechSettings, getAvailableDeviceVoices, DeviceVoiceOption, fetchTTSAudioUrl } from "../../services/speechVoices";
import { getSafeWindowSpeechSynthesis } from "../../utils/platform";

export function useAudioSettings(initialSettings: SpeechSettings, onSave: (settings: SpeechSettings) => void) {
  const [currentSpeechSettings, setCurrentSpeechSettings] = useState<SpeechSettings>(initialSettings);
  const [deviceVoices, setDeviceVoices] = useState<DeviceVoiceOption[]>([]);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setCurrentSpeechSettings(initialSettings);
  }, [initialSettings]);

  useEffect(() => {
    const loadVoices = () => {
      const voices = getAvailableDeviceVoices();
      setDeviceVoices(voices);
    };

    loadVoices();
    const synth = getSafeWindowSpeechSynthesis();
    if (synth) {
      synth.onvoiceschanged = loadVoices;
    }
    return () => {
      if (synth) synth.onvoiceschanged = null;
    };
  }, []);

  const stopPreview = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.src = "";
      previewAudioRef.current = null;
    }
    const synth = getSafeWindowSpeechSynthesis();
    if (synth && synth.speaking) {
      synth.cancel();
    }
    setPreviewingVoiceId(null);
    setIsPreviewLoading(false);
  };

  const handlePreviewVoice = async (voiceName: string, engine: "gemini" | "device") => {
    stopPreview();
    setIsPreviewLoading(true);
    setPreviewError(null);
    setPreviewingVoiceId(voiceName);

    const samplePhrase = `Hello! I'm ${voiceName}, ready to narrate your Gemini responses.`;

    if (engine === "gemini") {
      try {
        const data = await fetchTTSAudioUrl(samplePhrase, voiceName);
        if (!data || !data.audioUrl) throw new Error("Audio URL is null");
        const audio = new Audio(data.audioUrl);
        previewAudioRef.current = audio;
        audio.onended = () => {
          setPreviewingVoiceId(null);
          setIsPreviewLoading(false);
        };
        await audio.play();
      } catch (err) {
        console.error("Failed to preview TTS voice:", err);
        setPreviewError("Failed to load Gemini TTS voice preview.");
        setPreviewingVoiceId(null);
        setIsPreviewLoading(false);
      }
    } else {
      const synth = getSafeWindowSpeechSynthesis();
      if (synth) {
        const utterance = new SpeechSynthesisUtterance(samplePhrase);
        const rawVoices = synth.getVoices();
        const selectedVoice = rawVoices.find(
          (v) => v.name === voiceName || v.voiceURI === voiceName
        );
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
        utterance.onend = () => {
          setPreviewingVoiceId(null);
          setIsPreviewLoading(false);
        };
        utterance.onerror = () => {
          setPreviewError("Device speech synthesis failed.");
          setPreviewingVoiceId(null);
          setIsPreviewLoading(false);
        };
        synth.speak(utterance);
      } else {
        setPreviewError("Device TTS not supported in this environment.");
        setPreviewingVoiceId(null);
        setIsPreviewLoading(false);
      }
    }
  };

  const handleSelectAudioEngine = (engine: "gemini" | "device") => {
    const updated: SpeechSettings = { ...currentSpeechSettings, engine };
    setCurrentSpeechSettings(updated);
    onSave(updated);
  };

  const handleSelectGeminiVoice = (voiceName: string) => {
    const updated: SpeechSettings = { ...currentSpeechSettings, geminiVoice: voiceName };
    setCurrentSpeechSettings(updated);
    onSave(updated);
  };

  const handleSelectDeviceVoice = (voiceId: string) => {
    const updated: SpeechSettings = { ...currentSpeechSettings, deviceVoiceURI: voiceId };
    setCurrentSpeechSettings(updated);
    onSave(updated);
  };

  const handleSelectRate = (playbackRate: number) => {
    const updated: SpeechSettings = { ...currentSpeechSettings, playbackRate };
    setCurrentSpeechSettings(updated);
    onSave(updated);
    if (previewAudioRef.current) {
      previewAudioRef.current.playbackRate = playbackRate;
    }
  };

  const handleToggleAutoRead = (val: boolean) => {
    const updated: SpeechSettings = { ...currentSpeechSettings, autoReadResponses: val };
    setCurrentSpeechSettings(updated);
    onSave(updated);
  };

  const handleToggleHandsFree = (val: boolean) => {
    const updated: SpeechSettings = { ...currentSpeechSettings, handsFreeMode: val };
    setCurrentSpeechSettings(updated);
    onSave(updated);
  };

  const handleToggleSentenceStreaming = (val: boolean) => {
    const updated: SpeechSettings = { ...currentSpeechSettings, sentenceStreaming: val };
    setCurrentSpeechSettings(updated);
    onSave(updated);
  };

  return {
    currentSpeechSettings,
    deviceVoices,
    previewingVoiceId,
    isPreviewLoading,
    previewError,
    stopPreview,
    handlePreviewVoice,
    handleSelectAudioEngine,
    handleSelectGeminiVoice,
    handleSelectDeviceVoice,
    handleSelectRate,
    handleToggleAutoRead,
    handleToggleHandsFree,
    handleToggleSentenceStreaming,
  };
}
