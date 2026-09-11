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
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => ISpeechRecognitionInstance;

interface WindowWithSpeech {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

export interface UseSpeechToTextOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onError?: (err: string) => void;
}

export interface UseSpeechToTextReturn {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  error: string | null;
  startListening: (onResult?: (text: string, isFinal: boolean) => void) => void;
  stopListening: () => void;
  toggleListening: (onResult?: (text: string, isFinal: boolean) => void) => void;
}

export function useSpeechToText(options: UseSpeechToTextOptions = {}): UseSpeechToTextReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<ISpeechRecognitionInstance | null>(null);
  const callbackRef = useRef<((text: string, isFinal: boolean) => void) | undefined>(
    options.onTranscript
  );

  useEffect(() => {
    callbackRef.current = options.onTranscript;
  }, [options.onTranscript]);

  const getConstructor = useCallback((): SpeechRecognitionConstructor | undefined => {
    if (typeof window === "undefined") return undefined;
    const win = window as unknown as WindowWithSpeech;
    return win.SpeechRecognition || win.webkitSpeechRecognition;
  }, []);

  const isSupported = Boolean(getConstructor());

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore if already stopped
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(
    (onResult?: (text: string, isFinal: boolean) => void) => {
      setError(null);
      stopListening();

      const SpeechRecognitionClass = getConstructor();

      if (!SpeechRecognitionClass) {
        setError("Web Speech API is not supported in this browser.");
        return;
      }

      try {
        const recognition = new SpeechRecognitionClass();
        recognitionRef.current = recognition;

        recognition.lang = options.lang || (typeof navigator !== "undefined" ? navigator.language : "en-US");
        recognition.continuous = options.continuous ?? true;
        recognition.interimResults = options.interimResults ?? true;

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: SpeechRecognitionEventLike) => {
          let currentInterim = "";
          let finalChunk = "";

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const result = event.results[i];
            const text = result[0]?.transcript || "";
            if (result.isFinal) {
              finalChunk += text;
            } else {
              currentInterim += text;
            }
          }

          const combined = (finalChunk || currentInterim).trim();
          if (combined) {
            setTranscript(combined);
            if (onResult) {
              onResult(combined, Boolean(finalChunk));
            } else if (callbackRef.current) {
              callbackRef.current(combined, Boolean(finalChunk));
            }
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
          const errType = event.error || "speech-recognition-error";
          if (errType !== "no-speech") {
            setError(errType);
            if (options.onError) {
              options.onError(errType);
            }
          }
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.start();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to start speech recognition.";
        setError(message);
        setIsListening(false);
      }
    },
    [options, stopListening, getConstructor]
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
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Cleanup
        }
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    toggleListening,
  };
}
