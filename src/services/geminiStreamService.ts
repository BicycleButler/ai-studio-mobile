import { GenerateRequestBody } from "../types";
import { apiFetch, apiFetchStream, BaseApiError, isAbortError } from "../utils/apiClient";
import { SSEStreamParser } from "../utils/sseParser";


export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onDone?: (metadata: { durationMs: number; totalTokens: number }) => void;
  onError?: (error: Error) => void;
}

export interface StreamOptions {
  apiKey?: string;
  signal?: AbortSignal;
}

export async function fetchGenerateContent(payload: GenerateRequestBody, options?: StreamOptions): Promise<{
  text?: string;
  durationMs?: number;
  error?: string;
  usageMetadata?: { totalTokenCount?: number };
}> {
  return apiFetch("/api/generate", {
    method: "POST",
    headers: buildHeaders(options?.apiKey),
    signal: options?.signal,
    body: JSON.stringify(payload),
  });
}

/**
 * Strips raw Google API keys and project tokens from strings before logging or UI exposure.
 */
export function sanitizeLogMessage(message: string): string {
  if (!message) return "";
  return message
    .replace(/AIza[0-9A-Za-z\-_]{35}/g, (match) => `${match.slice(0, 4)}...${match.slice(-4)}`)
    .replace(/AQ\.[0-9A-Za-z\-_]{10,}/g, (match) => `${match.slice(0, 4)}...[REDACTED]`);
}

/**
 * Scrubs sensitive authentication and authorization headers from client error-logging payloads.
 */
export function sanitizeHeadersForLogging(headers: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (
      lower.includes("key") ||
      lower.includes("auth") ||
      lower.includes("bearer") ||
      lower.includes("secret") ||
      lower.includes("token")
    ) {
      sanitized[key] = value.length > 8 ? `${value.slice(0, 4)}...[SCRUBBED]` : "[REDACTED]";
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export class GeminiApiError extends Error {
  public statusCode?: number;
  public isQuotaError: boolean;
  public isAuthError: boolean;
  public isKeyInvalid: boolean;
  public isRevoked: boolean;
  public isUnavailable: boolean;

  constructor(rawMessage: string, statusCode?: number) {
    const cleanMessage = sanitizeLogMessage(rawMessage);
    super(cleanMessage);
    this.name = "GeminiApiError";
    this.statusCode = statusCode;
    const msg = cleanMessage.toLowerCase();

    this.isUnavailable =
      statusCode === 503 ||
      msg.includes("unavailable") ||
      msg.includes("service is currently unavailable") ||
      msg.includes("overloaded") ||
      msg.includes("backend error");

    this.isQuotaError =
      statusCode === 429 ||
      msg.includes("quota") ||
      msg.includes("resource_exhausted") ||
      msg.includes("rate limit") ||
      msg.includes("quota exceeded");

    this.isKeyInvalid =
      (statusCode === 400 &&
        (msg.includes("api_key_invalid") ||
          msg.includes("api key not valid") ||
          msg.includes("invalid api key") ||
          msg.includes("key expired") ||
          msg.includes("api key expired") ||
          msg.includes("bad request: api_key"))) ||
      statusCode === 401 ||
      statusCode === 403 ||
      msg.includes("api_key_invalid") ||
      msg.includes("key expired") ||
      msg.includes("revoked") ||
      msg.includes("permission_denied") ||
      msg.includes("unauthenticated");

    this.isRevoked =
      msg.includes("revoked") ||
      msg.includes("key expired") ||
      msg.includes("expired") ||
      msg.includes("deleted");

    this.isAuthError = this.isKeyInvalid;
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
  if (isAbortError(err)) {
    return new GeminiApiError("Generation stopped by user.");
  }
  if (err instanceof Error) {
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
  let response: Response;
  try {
    response = await apiFetchStream("/api/generate", {
      method: "POST",
      headers: buildHeaders(options?.apiKey),
      signal: options?.signal,
      body: JSON.stringify({
        ...payload,
        stream: true,
      }),
    });
  } catch (err: unknown) {
    if (err instanceof BaseApiError) {
      throw new GeminiApiError(err.message, err.statusCode);
    }
    throw new GeminiApiError("Streaming API request failed", 500);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new GeminiApiError("Streaming is not supported by the network response.");
  }

  const decoder = new TextDecoder();
  let accumulatedText = "";
  let durationMs = 0;
  let totalTokens = 0;

  // We define a helper that processes the JSON payload from the SSE message
  const handleData = (dataStr: string) => {
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
        durationMs = parsed.durationMs ?? durationMs;
        if (parsed.usageMetadata?.totalTokenCount) {
          totalTokens = parsed.usageMetadata.totalTokenCount;
        }
      }
    } catch (parseErr: unknown) {
      if (parseErr instanceof GeminiApiError) {
        throw parseErr;
      }
      // Ignore JSON parse errors for incomplete/malformed chunks
    }
  };

  const sseParser = new SSEStreamParser((eventName, dataStr) => {
    handleData(dataStr);
  });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Decode with stream: true to retain multibyte character boundary state
      const chunk = decoder.decode(value, { stream: true });
      sseParser.processChunk(chunk);
    }

    sseParser.flush();

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
