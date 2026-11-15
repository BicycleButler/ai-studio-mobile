import { IPlatformService } from "./IPlatformService";
import { GenerateRequestBody, ModelProviderId } from "../types";
import { IApiClient, BaseApiError, isAbortError } from "../utils/apiClient";
import { SSEStreamParser, ISSEStreamParserFactory } from "../utils/sseParser";
import { ILogger } from "../utils/logger";
import { BrowserPlatformService } from "../services/platformService";
import { IProviderConnectionService } from "../utils/storage/providers";
import { ILocalModelService } from "./localModelService";
import { isLocalProvider } from "../utils/providerCatalog";
import { errorReporter } from "../utils/errorReporter";

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onDone?: (metadata: { durationMs: number; totalTokens: number }) => void;
  onError?: (error: Error) => void;
}

export interface StreamOptions {
  apiKey?: string;
  providerId?: ModelProviderId;
  connectionId?: string;
  signal?: AbortSignal;
}


/**
 * Strips raw Google API keys and project tokens from strings before logging or UI exposure.
 */

export class GeminiApiError extends Error {
  public statusCode?: number;
  public isQuotaError: boolean;
  public isAuthError: boolean;
  public isKeyInvalid: boolean;
  public isRevoked: boolean;
  public isUnavailable: boolean;

  constructor(rawMessage: string, statusCode?: number) {
    const cleanMessage = rawMessage
      .replace(/AIza[0-9A-Za-z\-_]{35}/g, (match) => `${match.slice(0, 4)}...${match.slice(-4)}`)
      .replace(/AQ\.[0-9A-Za-z\-_]{10,}/g, (match) => `${match.slice(0, 4)}...[REDACTED]`)
      .replace(/sk-(?:proj-|ant-|or-v1-)?[0-9A-Za-z\-_]{16,}/g, (match) => `${match.slice(0, 5)}...[REDACTED]`)
      .replace(/gsk_[0-9A-Za-z\-_]{16,}/g, (match) => `${match.slice(0, 5)}...[REDACTED]`);
    super(cleanMessage);
    this.name = "GeminiApiError";
    this.statusCode = statusCode;
    const msg = cleanMessage.toLowerCase();

    this.isUnavailable =
      statusCode === 503 ||
      statusCode === 504 ||
      statusCode === 502 ||
      msg.includes("unavailable") ||
      msg.includes("service is currently unavailable") ||
      msg.includes("overloaded") ||
      msg.includes("timed out") ||
      msg.includes("stalled") ||
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





export interface IGeminiStreamService {
  formatStreamError(err: unknown): GeminiApiError;
  fetchGenerateContent(payload: GenerateRequestBody, options?: StreamOptions): Promise<{
    text?: string;
    durationMs?: number;
    error?: string;
    usageMetadata?: { totalTokenCount?: number };
  }>;
  streamGeminiContent(
    payload: GenerateRequestBody,
    callbacks: StreamCallbacks,
    options?: StreamOptions
  ): Promise<{ text: string; durationMs: number; totalTokens: number }>;
}

export interface GeminiStreamServiceConfig {
  apiClient: IApiClient;
  logger: ILogger;
  sseStreamParserFactory?: ISSEStreamParserFactory;
  platformService?: IPlatformService;
  providerConnectionService?: IProviderConnectionService;
  localModelService?: ILocalModelService;
  connectTimeoutMs?: number;
  chunkIdleTimeoutMs?: number;
  maxConnectRetries?: number;
  retryDelayMs?: number;
}

const DEFAULT_CONNECT_TIMEOUT_MS = 30_000;
const DEFAULT_CHUNK_IDLE_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_CONNECT_RETRIES = 1;
const DEFAULT_RETRY_DELAY_MS = 500;
const RETRYABLE_STREAM_INIT_STATUSES = new Set([429, 502, 503, 504, 0]);

export class GeminiStreamService implements IGeminiStreamService {
  private apiClient: IApiClient;
  private logger: ILogger;
  private sseStreamParserFactory: ISSEStreamParserFactory;
  private platformService: IPlatformService;
  private providerConnectionService?: IProviderConnectionService;
  private localModelService?: ILocalModelService;
  private connectTimeoutMs: number;
  private chunkIdleTimeoutMs: number;
  private maxConnectRetries: number;
  private retryDelayMs: number;

  constructor(config: GeminiStreamServiceConfig) {
    this.apiClient = config.apiClient;
    this.logger = config.logger;
    this.sseStreamParserFactory = config.sseStreamParserFactory || {
      create: (onEvent) => new SSEStreamParser(onEvent)
    };
    this.platformService = config.platformService || new BrowserPlatformService();
    this.providerConnectionService = config.providerConnectionService;
    this.localModelService = config.localModelService;
    this.connectTimeoutMs = config.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
    this.chunkIdleTimeoutMs = config.chunkIdleTimeoutMs ?? DEFAULT_CHUNK_IDLE_TIMEOUT_MS;
    this.maxConnectRetries = config.maxConnectRetries ?? DEFAULT_MAX_CONNECT_RETRIES;
    this.retryDelayMs = config.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  }

  public sanitizeLogMessage(message: string): string {
    if (!message) return "";
    return message
      .replace(/AIza[0-9A-Za-z\-_]{35}/g, (match) => `${match.slice(0, 4)}...${match.slice(-4)}`)
      .replace(/AQ\.[0-9A-Za-z\-_]{10,}/g, (match) => `${match.slice(0, 4)}...[REDACTED]`)
      .replace(/sk-(?:proj-|ant-|or-v1-)?[0-9A-Za-z\-_]{16,}/g, (match) => `${match.slice(0, 5)}...[REDACTED]`)
      .replace(/gsk_[0-9A-Za-z\-_]{16,}/g, (match) => `${match.slice(0, 5)}...[REDACTED]`);
  }

  public sanitizeHeadersForLogging(headers: Record<string, string>): Record<string, string> {
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

  public buildHeaders(
    customApiKey?: string,
    providerContext?: { providerId?: ModelProviderId; providerApiKey?: string; baseUrl?: string }
  ): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (customApiKey && customApiKey.trim()) {
      headers["x-gemini-api-key"] = customApiKey.trim();
    }
    if (providerContext?.providerId && providerContext.providerId !== "google") {
      headers["x-provider-type"] = providerContext.providerId;
      if (providerContext.providerApiKey?.trim()) {
        headers["x-provider-api-key"] = providerContext.providerApiKey.trim();
      }
      if (providerContext.baseUrl?.trim()) {
        headers["x-provider-base-url"] = providerContext.baseUrl.trim();
      }
    }
    return headers;
  }

  public formatStreamError(err: unknown): GeminiApiError {
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

  public async fetchGenerateContent(payload: GenerateRequestBody, options?: StreamOptions): Promise<{
    text?: string;
    durationMs?: number;
    error?: string;
    usageMetadata?: { totalTokenCount?: number };
  }> {
    return this.apiClient.fetch("/api/generate", {
      method: "POST",
      headers: this.buildHeaders(options?.apiKey),
      signal: options?.signal,
      body: JSON.stringify(payload),
    });
  }

  /**
   * High-reliability Server-Sent Events (SSE) stream consumer.
   * Correctly buffers partial chunks across TCP packet boundaries to prevent broken JSON payloads.
   */
  public async streamGeminiContent(
    payload: GenerateRequestBody,
    callbacks: StreamCallbacks,
    options?: StreamOptions
  ): Promise<{ text: string; durationMs: number; totalTokens: number }> {
    const providerId: ModelProviderId =
      payload.providerId || options?.providerId || "google";
    const connectionId = payload.connectionId || options?.connectionId;
    const resolvedConn =
      providerId !== "google" && this.providerConnectionService
        ? this.providerConnectionService.resolveConnectionForRequest(
            payload.model || "",
            providerId,
            connectionId
          )
        : undefined;

    // 1. Handle 100% client-side local / on-device models
    if (isLocalProvider(providerId) && this.localModelService) {
      try {
        if (providerId === "local-webllm") {
          return await this.localModelService.streamWebLLMChat(
            payload,
            callbacks,
            options?.signal
          );
        }
        if (providerId === "local-browser") {
          return await this.localModelService.streamBrowserAIChat(
            payload,
            callbacks,
            options?.signal
          );
        }
        if (providerId === "local-ollama" && !resolvedConn?.proxyViaServer) {
          const baseUrl = payload.baseUrl || resolvedConn?.baseUrl || "http://localhost:11434";
          return await this.localModelService.streamLocalServerChat(
            baseUrl,
            resolvedConn?.apiKey,
            payload,
            callbacks,
            options?.signal
          );
        }
      } catch (err: unknown) {
        const formatted = this.formatStreamError(err);
        callbacks.onError?.(formatted);
        throw formatted;
      }
    }

    let response!: Response;
    const headers = this.buildHeaders(
      options?.apiKey,
      providerId !== "google"
        ? {
            providerId,
            providerApiKey: resolvedConn?.apiKey,
            baseUrl: payload.baseUrl || resolvedConn?.baseUrl,
          }
        : undefined
    );

    const createLinkedController = (parentSignal?: AbortSignal) => {
      const controller = this.platformService.createAbortController();
      if (!controller) return { controller: null, cleanup: () => {} };
      const onParentAbort = () => controller.abort(parentSignal?.reason);
      if (parentSignal) {
        if (parentSignal.aborted) {
          controller.abort(parentSignal.reason);
        } else {
          parentSignal.addEventListener("abort", onParentAbort, { once: true });
        }
      }
      return {
        controller,
        cleanup: () => {
          parentSignal?.removeEventListener("abort", onParentAbort);
        },
      };
    };

    const delayWithAbort = (ms: number, signal?: AbortSignal) =>
      new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        const onAbort = () => {
          this.platformService.clearTimeout(timer);
          reject(new DOMException("Aborted", "AbortError"));
        };
        const timer = this.platformService.setTimeout(() => {
          signal?.removeEventListener("abort", onAbort);
          resolve();
        }, ms);
        signal?.addEventListener("abort", onAbort, { once: true });
      });

    const linked = createLinkedController(options?.signal);
    let timedOutReason: string | null = null;

    const reqOptions: RequestInit = {
      method: "POST",
      headers,
      signal: linked.controller?.signal ?? options?.signal,
      body: JSON.stringify({
        ...payload,
        providerId,
        baseUrl: payload.baseUrl || resolvedConn?.baseUrl,
        stream: true,
      }),
    };

    const totalAttempts = Math.max(1, 1 + this.maxConnectRetries);
    try {
      for (let attempt = 0; attempt < totalAttempts; attempt++) {
        let connectTimer: unknown = null;
        if (linked.controller && this.connectTimeoutMs > 0) {
          connectTimer = this.platformService.setTimeout(() => {
            timedOutReason = `Connection timed out after ${Math.round(this.connectTimeoutMs / 1000)}s.`;
            linked.controller?.abort();
          }, this.connectTimeoutMs);
        }
        try {
          response = await this.apiClient.fetchStream("/api/generate", reqOptions);
          break;
        } catch (err: unknown) {
          if (connectTimer !== null) {
            this.platformService.clearTimeout(connectTimer);
            connectTimer = null;
          }
          if (timedOutReason) {
            const timeoutErr = new GeminiApiError(timedOutReason, 504);
            errorReporter.report("stream_error", timeoutErr.message, {
              scope: providerId,
              metadata: { statusCode: 504 },
            });
            throw timeoutErr;
          }
          if (isAbortError(err)) {
            throw new GeminiApiError("Generation stopped by user.");
          }
          const statusCode = err instanceof BaseApiError ? err.statusCode : 500;
          const canRetry =
            attempt < totalAttempts - 1 &&
            !options?.signal?.aborted &&
            RETRYABLE_STREAM_INIT_STATUSES.has(statusCode);
          if (canRetry) {
            let retryDelay = this.retryDelayMs * (attempt + 1);
            if (err instanceof BaseApiError && err.headers) {
              const rawRetryAfter = err.headers["retry-after"] || err.headers["Retry-After"];
              if (rawRetryAfter) {
                const seconds = Number(rawRetryAfter);
                if (Number.isFinite(seconds) && seconds >= 0) {
                  retryDelay = Math.min(seconds * 1000, 30_000);
                } else {
                  const dateMs = Date.parse(rawRetryAfter);
                  if (Number.isFinite(dateMs)) {
                    retryDelay = Math.max(0, Math.min(dateMs - Date.now(), 30_000));
                  }
                }
              }
            }
            await delayWithAbort(retryDelay, options?.signal);
            continue;
          }
          if (err instanceof BaseApiError) {
            const apiErr = new GeminiApiError(err.message, err.statusCode);
            errorReporter.report("stream_error", apiErr.message, {
              scope: providerId,
              metadata: { statusCode: err.statusCode },
            });
            throw apiErr;
          }
          // If we failed entirely, try to log sanitized headers
          const safeHeaders = this.sanitizeHeadersForLogging(reqOptions.headers as Record<string, string>);
          this.logger.error(`Stream initialization failed`, { headers: safeHeaders, err });
          const apiErr = new GeminiApiError("Streaming API request failed", 500);
          errorReporter.report("stream_error", apiErr.message, {
            scope: providerId,
            metadata: { statusCode: 500 },
          });
          throw apiErr;
        } finally {
          if (connectTimer !== null) {
            this.platformService.clearTimeout(connectTimer);
          }
        }
      }
    } catch (initErr: unknown) {
      linked.cleanup();
      if (isAbortError(initErr) && !timedOutReason) {
        throw new GeminiApiError("Generation stopped by user.");
      }
      throw initErr;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      linked.cleanup();
      throw new GeminiApiError("Streaming is not supported by the network response.");
    }

    const decoder = this.platformService.createTextDecoder();
    if (!decoder) {
      linked.cleanup();
      await reader.cancel().catch(() => {});
      throw new GeminiApiError("TextDecoder is not supported in this environment.");
    }
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

    const sseParser = this.sseStreamParserFactory.create((eventName, dataStr) => {
      handleData(dataStr);
    });

    const readChunkWithTimeout = async (): Promise<ReadableStreamReadResult<Uint8Array>> => {
      if (this.chunkIdleTimeoutMs <= 0) {
        return reader.read();
      }
      return new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
        let settled = false;
        const timer = this.platformService.setTimeout(() => {
          if (settled) return;
          settled = true;
          timedOutReason = `Stream stalled with no data for ${Math.round(this.chunkIdleTimeoutMs / 1000)}s.`;
          linked.controller?.abort();
          reject(new GeminiApiError(timedOutReason, 504));
        }, this.chunkIdleTimeoutMs);

        reader
          .read()
          .then((res) => {
            if (settled) return;
            settled = true;
            this.platformService.clearTimeout(timer);
            resolve(res);
          })
          .catch((err) => {
            if (settled) return;
            settled = true;
            this.platformService.clearTimeout(timer);
            reject(err);
          });
      });
    };

    try {
      while (true) {
        const { done, value } = await readChunkWithTimeout();
        if (done) break;

        // Decode with stream: true to retain multibyte character boundary state
        const chunk = decoder.decode(value, { stream: true });
        sseParser.processChunk(chunk);
      }

      const trailing = decoder.decode();
      if (trailing) {
        sseParser.processChunk(trailing);
      }
      sseParser.flush();

      if (!totalTokens && accumulatedText.length > 0) {
        totalTokens = Math.max(1, Math.round(accumulatedText.length / 4));
      }

      callbacks.onDone?.({ durationMs, totalTokens });
      return { text: accumulatedText, durationMs, totalTokens };
    } catch (err: unknown) {
      let formatted: GeminiApiError;
      if (timedOutReason) {
        formatted = new GeminiApiError(timedOutReason, 504);
      } else if (err instanceof GeminiApiError) {
        formatted = err;
      } else if (isAbortError(err)) {
        formatted = new GeminiApiError("Generation stopped by user.");
      } else if (err instanceof Error) {
        formatted = new GeminiApiError(err.message);
      } else {
        formatted = new GeminiApiError("An unexpected error occurred during generation.");
      }
      if (!isAbortError(err) || timedOutReason) {
        errorReporter.report("stream_error", formatted.message, {
          scope: providerId,
          ...(formatted.statusCode ? { statusCode: formatted.statusCode } : {}),
        });
      }
      callbacks.onError?.(formatted);
      throw formatted;
    } finally {
      linked.cleanup();
      try {
        await reader.cancel();
      } catch {
        // Ignore stream cancel errors on closed/aborted streams
      }
    }
  }
}

