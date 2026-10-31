import { useState, useRef, useCallback } from "react";
import { SpeechSettings } from "../services/speechVoices";
import { useServices } from "../services/ServiceContext";

export interface UseSpeechPlaybackOptions {
  onPlay?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}

export function useSpeechPlayback(options: UseSpeechPlaybackOptions = {}) {
  const { speechVoicesService, platformService, logger } = useServices();

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isBufferingAudio, setIsBufferingAudio] = useState(false);

  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stopAllPlayback = useCallback(() => {
    if (activeUtteranceRef.current) {
      activeUtteranceRef.current = null;
    }
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    const synth = platformService.getSpeechSynthesis();
    if (synth) {
      synth.cancel();
    }
    setIsSpeaking(false);
    setIsBufferingAudio(false);
  }, [platformService]);

  const fallbackToDeviceSpeech = useCallback(
    (textToSpeak: string, speechSettings: SpeechSettings) => {
      const synth = platformService.getSpeechSynthesis();
      if (!synth) {
        setIsSpeaking(false);
        setIsBufferingAudio(false);
        if (options.onEnd) options.onEnd();
        return;
      }

      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      activeUtteranceRef.current = utterance;
      utterance.rate = speechSettings.playbackRate;

      // Pick chosen device voice or best natural voice
      const rawVoices = synth.getVoices();
      if (speechSettings.deviceVoiceURI) {
        const matched = rawVoices.find(
          (v) => v.voiceURI === speechSettings.deviceVoiceURI
        );
        if (matched) utterance.voice = matched;
      } else if (rawVoices.length > 0) {
        const naturalVoice = rawVoices.find((v) => {
          const name = v.name.toLowerCase();
          return (
            name.includes("natural") ||
            name.includes("enhanced") ||
            name.includes("google") ||
            name.includes("siri") ||
            name.includes("online")
          );
        });
        if (naturalVoice) utterance.voice = naturalVoice;
      }

      utterance.onstart = () => {
        setIsBufferingAudio(false);
        setIsSpeaking(true);
        if (options.onPlay) options.onPlay();
      };

      utterance.onend = () => {
        activeUtteranceRef.current = null;
        setIsSpeaking(false);
        if (options.onEnd) options.onEnd();
      };

      utterance.onerror = () => {
        activeUtteranceRef.current = null;
        setIsSpeaking(false);
        setIsBufferingAudio(false);
        if (options.onError) options.onError();
      };

      synth.speak(utterance);
    },
    [platformService, options]
  );

  const playSpeech = useCallback(
    async (contentToSpeak: string, speechSettings: SpeechSettings) => {
      if (!contentToSpeak.trim()) return;

      if (speechSettings.engine === "gemini") {
        setIsBufferingAudio(true);
        try {
          const data = await speechVoicesService.fetchTTSAudioUrl(
            contentToSpeak,
            speechSettings.geminiVoice
          );

          if (!data.audioUrl) {
            throw new Error("No audio payload returned from Gemini TTS");
          }

          const audio = new Audio(data.audioUrl);
          audio.playbackRate = speechSettings.playbackRate;
          activeAudioRef.current = audio;

          audio.onplay = () => {
            setIsBufferingAudio(false);
            setIsSpeaking(true);
            if (options.onPlay) options.onPlay();
          };

          audio.onended = () => {
            setIsSpeaking(false);
            activeAudioRef.current = null;
            if (options.onEnd) options.onEnd();
          };

          audio.onerror = () => {
            logger.warn("Audio element error, falling back to on-device natural voice");
            fallbackToDeviceSpeech(contentToSpeak, speechSettings);
          };

          await audio.play();
        } catch (err: unknown) {
          logger.warn("Gemini Studio TTS failed, falling back to on-device voice:", err);
          fallbackToDeviceSpeech(contentToSpeak, speechSettings);
        }
      } else {
        fallbackToDeviceSpeech(contentToSpeak, speechSettings);
      }
    },
    [speechVoicesService, logger, fallbackToDeviceSpeech, options]
  );

  return {
    isSpeaking,
    isBufferingAudio,
    playSpeech,
    stopAllPlayback,
  };
}
