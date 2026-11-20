import { useState, useRef, useCallback, useEffect } from "react";
import { GenerateRequestBody } from "../types";
import { GeminiApiError } from "../services/geminiStreamService";
import { useServices } from "../services/ServiceContext";
import { createStreamCoalescer, StreamCoalescer } from "../utils/streamCoalescer";

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
  getLastError: () => GeminiApiError | null;
  startStream: (
    payload: GenerateRequestBody,
    chunkCallback?: (accumulatedText: string) => void
  ) => Promise<{ text: string; durationMs: number; totalTokens: number } | null>;
  stopStream: () => void;
  clearError: () => void;
}

const STREAM_COALESCE_INTERVAL_MS = 32;

export function useGeminiStream(options: UseGeminiStreamOptions = {}): UseGeminiStreamReturn {
  const { geminiStreamService, platformService, timeProvider } = useServices();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<GeminiApiError | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [tokenCount, setTokenCount] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const activeCoalescerRef = useRef<StreamCoalescer<string> | null>(null);
  const lastErrorRef = useRef<GeminiApiError | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Cleanup abort controller and pending coalescer timer on unmount
  useEffect(() => {
    return () => {
      activeCoalescerRef.current?.cancel();
      activeCoalescerRef.current = null;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const stopStream = useCallback(() => {
    activeCoalescerRef.current?.cancel();
    activeCoalescerRef.current = null;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  }, []);

  const clearError = useCallback(() => {
    lastErrorRef.current = null;
    setError(null);
    setErrorDetails(null);
  }, []);

  const getLastError = useCallback(() => lastErrorRef.current, []);

  const startStream = useCallback(
    async (
      payload: GenerateRequestBody,
      chunkCallback?: (accumulatedText: string) => void
    ): Promise<{ text: string; durationMs: number; totalTokens: number } | null> => {
      // Abort any existing stream and drop pending coalesced chunks
      activeCoalescerRef.current?.cancel();
      activeCoalescerRef.current = null;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = platformService.createAbortController();
      if (!controller) {
          throw new Error("AbortController is not supported in this environment.");
      }
      abortControllerRef.current = controller;
      lastErrorRef.current = null;

      const coalescer = createStreamCoalescer<string>(
        (accumulatedText) => {
          if (abortControllerRef.current !== controller) return;
          chunkCallback?.(accumulatedText);
          optionsRef.current.onChunk?.(accumulatedText);
        },
        {
          intervalMs: STREAM_COALESCE_INTERVAL_MS,
          schedule: (cb, delayMs) => platformService.setTimeout(cb, delayMs),
          cancelSchedule: (handle) =>
            platformService.clearTimeout(handle as ReturnType<typeof setTimeout>),
          now: () => timeProvider.now(),
        }
      );
      activeCoalescerRef.current = coalescer;

      setIsGenerating(true);
      setError(null);
      setErrorDetails(null);
      setDurationMs(0);
      setTokenCount(0);

      try {
        const result = await geminiStreamService.streamGeminiContent(
          payload,
          {
            onChunk: (accumulatedText) => {
              if (abortControllerRef.current !== controller) return;
              coalescer.push(accumulatedText);
            },
            onDone: (meta) => {
              if (abortControllerRef.current !== controller) return;
              coalescer.flush();
              setDurationMs(meta.durationMs);
              setTokenCount(meta.totalTokens);
            },
          },
          {
            apiKey: optionsRef.current.customApiKey,
            signal: controller.signal,
          }
        );

        if (abortControllerRef.current === controller) {
          coalescer.flush();
          optionsRef.current.onComplete?.(result);
        }
        return result;
      } catch (err: unknown) {
        coalescer.cancel();
        // Map raw unknown errors cleanly through the abstraction layer using `geminiStreamService.formatStreamError`
        const apiErr = geminiStreamService.formatStreamError(err);
        if (abortControllerRef.current === controller) {
          lastErrorRef.current = apiErr;
          setError(apiErr.message);
          setErrorDetails(apiErr);
          optionsRef.current.onError?.(apiErr);
        }
        return null;
      } finally {
        if (activeCoalescerRef.current === coalescer) {
          coalescer.cancel();
          activeCoalescerRef.current = null;
        }
        if (abortControllerRef.current === controller) {
          setIsGenerating(false);
          abortControllerRef.current = null;
        }
      }
    },
    [geminiStreamService, platformService, timeProvider]
  );

  return {
    isGenerating,
    error,
    errorDetails,
    durationMs,
    tokenCount,
    getLastError,
    startStream,
    stopStream,
    clearError,
  };
}
