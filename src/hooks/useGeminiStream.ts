import { useState, useRef, useCallback, useEffect } from "react";
import { GenerateRequestBody } from "../types";
import { streamGeminiContent, GeminiApiError } from "../services/geminiStreamService";

export interface UseGeminiStreamOptions {
  customApiKey?: string;
  onChunk?: (chunkText: string) => void;
  onComplete?: (result: { text: string; durationMs: number; totalTokens: number }) => void;
  onError?: (error: GeminiApiError) => void;
}

export interface UseGeminiStreamReturn {
  isGenerating: boolean;
  error: string | null;
  errorDetails: GeminiApiError | null;
  durationMs: number;
  tokenCount: number;
  startStream: (
    payload: GenerateRequestBody,
    chunkCallback?: (accumulatedText: string) => void
  ) => Promise<{ text: string; durationMs: number; totalTokens: number } | null>;
  stopStream: () => void;
  clearError: () => void;
}

export function useGeminiStream(options: UseGeminiStreamOptions = {}): UseGeminiStreamReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<GeminiApiError | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [tokenCount, setTokenCount] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setErrorDetails(null);
  }, []);

  const startStream = useCallback(
    async (
      payload: GenerateRequestBody,
      chunkCallback?: (accumulatedText: string) => void
    ): Promise<{ text: string; durationMs: number; totalTokens: number } | null> => {
      // Abort any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsGenerating(true);
      setError(null);
      setErrorDetails(null);
      setDurationMs(0);
      setTokenCount(0);

      try {
        const result = await streamGeminiContent(
          payload,
          {
            onChunk: (accumulatedText) => {
              chunkCallback?.(accumulatedText);
              optionsRef.current.onChunk?.(accumulatedText);
            },
            onDone: (meta) => {
              setDurationMs(meta.durationMs);
              setTokenCount(meta.totalTokens);
            },
          },
          {
            apiKey: optionsRef.current.customApiKey,
            signal: controller.signal,
          }
        );

        optionsRef.current.onComplete?.(result);
        return result;
      } catch (err: unknown) {
        if (err instanceof GeminiApiError) {
          setError(err.message);
          setErrorDetails(err);
          optionsRef.current.onError?.(err);
        } else if (err instanceof Error) {
          const apiErr = new GeminiApiError(err.message);
          setError(err.message);
          setErrorDetails(apiErr);
          optionsRef.current.onError?.(apiErr);
        }
        return null;
      } finally {
        setIsGenerating(false);
        abortControllerRef.current = null;
      }
    },
    []
  );

  return {
    isGenerating,
    error,
    errorDetails,
    durationMs,
    tokenCount,
    startStream,
    stopStream,
    clearError,
  };
}
