import { isBrowserEnvironment } from "../utils/platform";
import { useServices } from "../services/ServiceContext";
import { useState, useRef, useEffect, useCallback } from "react";

// Safe Web Speech API TypeScript definitions
interface SpeechRecognitionResultItem {
  transcript: string;
}

interface SpeechRecognitionAlternative {
  0?: SpeechRecognitionResultItem;
  isFinal?: boolean;
  length: number;
}

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

interface ISpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onsoundstart?: (() => void) | null;
  onsoundend?: (() => void) | null;
  onspeechstart?: (() => void) | null;
  onspeechend?: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => ISpeechRecognitionInstance;



export interface UseSpeechToTextOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  autoSendOnSilence?: boolean;
  silenceTimeoutMs?: number;
  continuousListening?: boolean;
  isMuted?: boolean;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onSilenceAutoSend?: (finalTranscript: string) => void;
  onError?: (err: string) => void;
}

export interface UseSpeechToTextReturn {
  isSupported: boolean;
  isListening: boolean;
  isAudioDetected: boolean;
  transcript: string;
  silenceCountdownMs: number | null;
  error: string | null;
  startListening: (onResult?: (text: string, isFinal: boolean) => void, forceContinuous?: boolean) => void;
  stopListening: () => void;
  toggleListening: (onResult?: (text: string, isFinal: boolean) => void, forceContinuous?: boolean) => void;
  clearSilenceCountdown: () => void;
  clearTranscript: () => void;
}

export function useSpeechToText(options: UseSpeechToTextOptions = {}): UseSpeechToTextReturn {
  const { logger, platformService } = useServices();
  const [isListening, setIsListening] = useState(false);
  const [isAudioDetected, setIsAudioDetected] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [silenceCountdownMs, setSilenceCountdownMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<ISpeechRecognitionInstance | null>(null);
  const shouldKeepListeningRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const activeTranscriptRef = useRef<string>("");
  const accumulatedAcrossRestartsRef = useRef<string>("");
  const callbackRef = useRef<((text: string, isFinal: boolean) => void) | undefined>(
    options.onTranscript
  );
  const optionsRef = useRef<UseSpeechToTextOptions>(options);

  useEffect(() => {
    optionsRef.current = options;
    callbackRef.current = options.onTranscript;
  }, [options]);

  const getConstructor = useCallback((): SpeechRecognitionConstructor | undefined => {
    if (!isBrowserEnvironment()) return undefined;
    const win = platformService.getWindow() as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown } | null;
    return (win?.SpeechRecognition || win?.webkitSpeechRecognition) as SpeechRecognitionConstructor | undefined;
  }, [platformService]);

  const isSupported = Boolean(getConstructor());

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      platformService.clearTimeout(silenceTimerRef.current as unknown as number);
      silenceTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      platformService.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setSilenceCountdownMs(null);
  }, [platformService]);

  const clearTranscript = useCallback(() => {
    clearSilenceTimer();
    activeTranscriptRef.current = "";
    accumulatedAcrossRestartsRef.current = "";
    setTranscript("");
  }, [clearSilenceTimer]);

  const stopListening = useCallback(() => {
    shouldKeepListeningRef.current = false;
    clearSilenceTimer();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore if already stopped
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    setIsAudioDetected(false);
  }, [clearSilenceTimer]);

  const startListening = useCallback(
    (onResult?: (text: string, isFinal: boolean) => void, forceContinuous?: boolean) => {
      setError(null);
      clearSilenceTimer();
      // Only clear text on manual fresh start
      activeTranscriptRef.current = "";
      accumulatedAcrossRestartsRef.current = "";
      setTranscript("");

      const SpeechRecognitionClass = getConstructor();

      if (!SpeechRecognitionClass) {
        setError("Web Speech API is not supported in this browser.");
        return;
      }

      // Pre-flight microphone permission check if supported
      const nav = platformService.getNavigator() as Navigator & { mediaDevices?: { getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream> } } | null;
      if (nav && nav.mediaDevices && typeof nav.mediaDevices.getUserMedia === "function") {
        nav.mediaDevices.getUserMedia({ audio: true }).catch((permErr: unknown) => {
          logger.warn("[SpeechToText] Microphone pre-flight check notice:", permErr);
        });
      }

      try {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch {
            // Ignore
          }
          recognitionRef.current = null;
        }

        const recognition = new SpeechRecognitionClass();
        recognitionRef.current = recognition;
        const isContinuous = forceContinuous !== undefined ? forceContinuous : Boolean(optionsRef.current.continuousListening);
        shouldKeepListeningRef.current = isContinuous;

        recognition.lang =
          optionsRef.current.lang || platformService.getNavigator()?.language || "en-US";
        recognition.continuous = optionsRef.current.continuous ?? true;
        recognition.interimResults = optionsRef.current.interimResults ?? true;

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onsoundstart = () => {
          setIsAudioDetected(true);
        };

        recognition.onsoundend = () => {
          setIsAudioDetected(false);
        };

        recognition.onspeechstart = () => {
          setIsAudioDetected(true);
        };

        recognition.onspeechend = () => {
          setIsAudioDetected(false);
        };

        recognition.onresult = (event: SpeechRecognitionEventLike) => {
          // Acoustic echo suppression guard: if muted, discard input and clear any countdown
          if (optionsRef.current.isMuted) {
            clearSilenceTimer();
            return;
          }

          let sessionFinal = "";
          let sessionInterim = "";

          // Accumulate across ALL results from index 0 for continuous stability
          for (let i = 0; i < event.results.length; ++i) {
            const result = event.results[i];
            const text = result[0]?.transcript || "";
            if (result.isFinal) {
              sessionFinal += (sessionFinal ? " " : "") + text.trim();
            } else {
              sessionInterim += (sessionInterim ? " " : "") + text.trim();
            }
          }

          const currentChunk = sessionFinal
            ? (sessionInterim ? `${sessionFinal} ${sessionInterim}` : sessionFinal)
            : sessionInterim;

          const combined = accumulatedAcrossRestartsRef.current
            ? `${accumulatedAcrossRestartsRef.current} ${currentChunk}`.trim()
            : currentChunk.trim();

          if (combined) {
            setTranscript(combined);
            activeTranscriptRef.current = combined;

            if (onResult) {
              onResult(combined, Boolean(sessionFinal));
            } else if (callbackRef.current) {
              callbackRef.current(combined, Boolean(sessionFinal));
            }

            // VAD Silence Detection: trigger auto-send once user pauses speaking
            if (optionsRef.current.autoSendOnSilence) {
              clearSilenceTimer();
              const timeoutDelay = optionsRef.current.silenceTimeoutMs || 1500;

              // Start countdown timer for visible UI feedback
              setSilenceCountdownMs(timeoutDelay);
              const startTime = Date.now();
              countdownIntervalRef.current = platformService.setInterval(() => {
                const elapsed = Date.now() - startTime;
                const remaining = Math.max(0, timeoutDelay - elapsed);
                setSilenceCountdownMs(remaining);
                if (remaining <= 0 && countdownIntervalRef.current) {
                  platformService.clearInterval(countdownIntervalRef.current);
                  countdownIntervalRef.current = null;
                }
              }, 50);

              silenceTimerRef.current = platformService.setTimeout(() => {
                const textToSend = activeTranscriptRef.current.trim();
                clearSilenceTimer();
                if (textToSend.length > 0) {
                  stopListening();
                  activeTranscriptRef.current = "";
                  accumulatedAcrossRestartsRef.current = "";
                  optionsRef.current.onSilenceAutoSend?.(textToSend);
                }
              }, timeoutDelay) as unknown as ReturnType<typeof setTimeout>;
            }
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
          const errType = event.error || "speech-recognition-error";
          let friendlyError = errType;
          if (errType === "not-allowed" || errType === "service-not-allowed") {
            friendlyError = "Microphone permission denied. Please allow microphone access in your browser.";
          } else if (errType === "audio-capture") {
            friendlyError = "No microphone detected. Please check your audio input device.";
          }

          if (errType !== "no-speech") {
            setError(friendlyError);
            if (optionsRef.current.onError) {
              optionsRef.current.onError(friendlyError);
            }
          }
          if (errType !== "no-speech") {
            setIsListening(false);
            setIsAudioDetected(false);
            clearSilenceTimer();
          }
        };

        recognition.onend = () => {
          setIsAudioDetected(false);
          // Release dead recognition instance reference so restart condition passes
          if (recognitionRef.current === recognition) {
            recognitionRef.current = null;
          }
          // Resilient auto-restart in continuous hands-free voice mode
          const shouldRestart = shouldKeepListeningRef.current && Boolean(optionsRef.current.continuousListening);
          if (shouldRestart) {
            // Preserve finalized transcript across restart
            if (activeTranscriptRef.current) {
              accumulatedAcrossRestartsRef.current = activeTranscriptRef.current;
            }
            platformService.setTimeout(() => {
              if (shouldKeepListeningRef.current && !recognitionRef.current) {
                try {
                  const restartClass = getConstructor();
                  if (restartClass) {
                    const nextRec = new restartClass();
                    recognitionRef.current = nextRec;
                    nextRec.lang = optionsRef.current.lang || platformService.getNavigator()?.language || "en-US";
                    nextRec.continuous = optionsRef.current.continuous ?? true;
                    nextRec.interimResults = optionsRef.current.interimResults ?? true;
                    nextRec.onstart = () => setIsListening(true);
                    nextRec.onsoundstart = () => setIsAudioDetected(true);
                    nextRec.onsoundend = () => setIsAudioDetected(false);
                    nextRec.onspeechstart = () => setIsAudioDetected(true);
                    nextRec.onspeechend = () => setIsAudioDetected(false);
                    nextRec.onresult = recognition.onresult;
                    nextRec.onerror = recognition.onerror;
                    nextRec.onend = recognition.onend;
                    nextRec.start();
                  }
                } catch {
                  setIsListening(false);
                }
              }
            }, 150);
          } else {
            setIsListening(false);
          }
        };

        recognition.start();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to start speech recognition.";
        setError(message);
        setIsListening(false);
        setIsAudioDetected(false);
        clearSilenceTimer();
      }
    },
    [clearSilenceTimer, getConstructor, stopListening]
  );

  const toggleListening = useCallback(
    (onResult?: (text: string, isFinal: boolean) => void) => {
      if (isListening) {
        stopListening();
      } else {
        startListening(onResult);
      }
    },
    [isListening, startListening, stopListening]
  );

  useEffect(() => {
    return () => {
      clearSilenceTimer();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Cleanup
        }
      }
    };
  }, [clearSilenceTimer]);

  return {
    isSupported,
    isListening,
    isAudioDetected,
    transcript,
    silenceCountdownMs,
    error,
    startListening,
    stopListening,
    toggleListening,
    clearSilenceCountdown: clearSilenceTimer,
    clearTranscript,
  };
}
