import { GenerateRequestBody } from "../types";

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onDone?: (metadata: { durationMs: number; totalTokens: number }) => void;
  onError?: (error: Error) => void;
}

export interface StreamOptions {
  apiKey?: string;
  signal?: AbortSignal;
}

export class GeminiApiError extends Error {
  public statusCode?: number;
  public isQuotaError: boolean;
  public isAuthError: boolean;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "GeminiApiError";
    this.statusCode = statusCode;
    this.isQuotaError =
      statusCode === 429 ||
      message.toLowerCase().includes("quota") ||
      message.toLowerCase().includes("resource_exhausted") ||
      message.toLowerCase().includes("rate limit");
    this.isAuthError =
      statusCode === 401 ||
      statusCode === 403 ||
      message.toLowerCase().includes("api key") ||
      message.toLowerCase().includes("permission_denied") ||
      message.toLowerCase().includes("unauthenticated");
  }
}

/**
 * Standardizes headers for requests to the backend proxy
 */
export function buildHeaders(customApiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (customApiKey && customApiKey.trim()) {
    headers["x-gemini-api-key"] = customApiKey.trim();
  }
  return headers;
}

/**
 * Normalizes error messages from API or network failures
 */
export function formatStreamError(err: unknown): GeminiApiError {
  if (err instanceof GeminiApiError) {
    return err;
  }
  if (err instanceof Error) {
    if (err.name === "AbortError") {
      return new GeminiApiError("Generation stopped by user.");
    }
    return new GeminiApiError(err.message);
  }
  return new GeminiApiError("An unexpected error occurred during generation.");
}

/**
 * High-reliability Server-Sent Events (SSE) stream consumer.
 * Correctly buffers partial chunks across TCP packet boundaries to prevent broken JSON payloads.
 */
export async function streamGeminiContent(
  payload: GenerateRequestBody,
  callbacks: StreamCallbacks,
  options?: StreamOptions
): Promise<{ text: string; durationMs: number; totalTokens: number }> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: buildHeaders(options?.apiKey),
    signal: options?.signal,
    body: JSON.stringify({
      ...payload,
      stream: true,
    }),
  });

  if (!response.ok) {
    let errorDetail = `Server returned status ${response.status}`;
    try {
      const errorJson = (await response.json()) as { error?: string };
      if (errorJson.error) {
        errorDetail = errorJson.error;
      }
    } catch {
      // Ignore JSON parse error on response body
    }
    throw new GeminiApiError(errorDetail, response.status);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new GeminiApiError("Streaming is not supported by the network response.");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let accumulatedText = "";
  let durationMs = 0;
  let totalTokens = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Decode with stream: true to retain multibyte character boundary state
      buffer += decoder.decode(value, { stream: true });

      // Split lines and keep the remaining partial fragment in buffer
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || !line.startsWith("data: ")) continue;

        const dataStr = line.slice(6).trim();
        if (!dataStr) continue;

        try {
          const parsed = JSON.parse(dataStr) as {
            text?: string;
            error?: string;
            done?: boolean;
            durationMs?: number;
            usageMetadata?: { totalTokenCount?: number };
          };

          if (parsed.error) {
            throw new GeminiApiError(parsed.error);
          }

          if (parsed.text) {
            accumulatedText += parsed.text;
            callbacks.onChunk(accumulatedText);
          }

          if (parsed.done) {
            durationMs = parsed.durationMs ?? 0;
            if (parsed.usageMetadata?.totalTokenCount) {
              totalTokens = parsed.usageMetadata.totalTokenCount;
            }
          }
        } catch (parseErr: unknown) {
          if (parseErr instanceof GeminiApiError) {
            throw parseErr;
          }
          // Ignore incomplete/malformed chunks and continue stream reading
        }
      }
    }

    // Flush any remaining buffer text
    if (buffer.trim().startsWith("data: ")) {
      try {
        const dataStr = buffer.trim().slice(6).trim();
        const parsed = JSON.parse(dataStr) as {
          text?: string;
          error?: string;
          done?: boolean;
          durationMs?: number;
          usageMetadata?: { totalTokenCount?: number };
        };
        if (parsed.error) throw new GeminiApiError(parsed.error);
        if (parsed.text) {
          accumulatedText += parsed.text;
          callbacks.onChunk(accumulatedText);
        }
        if (parsed.done) {
          durationMs = parsed.durationMs ?? durationMs;
          if (parsed.usageMetadata?.totalTokenCount) {
            totalTokens = parsed.usageMetadata.totalTokenCount;
          }
        }
      } catch (flushErr: unknown) {
        if (flushErr instanceof GeminiApiError) throw flushErr;
      }
    }

    if (!totalTokens && accumulatedText.length > 0) {
      totalTokens = Math.max(1, Math.round(accumulatedText.length / 4));
    }

    callbacks.onDone?.({ durationMs, totalTokens });
    return { text: accumulatedText, durationMs, totalTokens };
  } catch (err: unknown) {
    const formatted = formatStreamError(err);
    callbacks.onError?.(formatted);
    throw formatted;
  }
}
