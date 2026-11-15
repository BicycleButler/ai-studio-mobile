import {
  GenerateRequestBody,
  IncomingMessage,
  LocalModelLoadProgress,
  ModelInfo,
} from "../types";
import { Observable, IObservable } from "../utils/observable";
import { ILogger } from "../utils/logger";
import { getErrorMessage } from "../utils/errorHandling";
import { LOCAL_PROVIDER_DEFINITIONS } from "../utils/providerCatalog";

export interface LocalStreamCallbacks {
  onChunk: (text: string) => void;
  onDone?: (metadata: { durationMs: number; totalTokens: number }) => void;
  onError?: (error: Error) => void;
}

export type BrowserAIAvailability = "readily" | "after-download" | "no" | "unsupported";

export interface ILocalModelService {
  webllmProgressObservable: IObservable<LocalModelLoadProgress>;
  loadedWebLLMModelId: string | null;
  isWebGPUSupported(): boolean;
  getWebLLMProgress(): LocalModelLoadProgress;
  hasWebLLMModelCached(modelId: string): Promise<boolean>;
  loadWebLLMModel(modelId: string): Promise<void>;
  unloadWebLLMModel(): Promise<void>;
  deleteWebLLMCache(modelId: string): Promise<void>;
  streamWebLLMChat(
    payload: GenerateRequestBody,
    callbacks: LocalStreamCallbacks,
    signal?: AbortSignal
  ): Promise<{ text: string; durationMs: number; totalTokens: number }>;
  checkBrowserAIAvailability(): Promise<BrowserAIAvailability>;
  streamBrowserAIChat(
    payload: GenerateRequestBody,
    callbacks: LocalStreamCallbacks,
    signal?: AbortSignal
  ): Promise<{ text: string; durationMs: number; totalTokens: number }>;
  probeLocalServer(baseUrl: string): Promise<{ valid: boolean; models: ModelInfo[]; error?: string }>;
  streamLocalServerChat(
    baseUrl: string,
    apiKey: string | undefined,
    payload: GenerateRequestBody,
    callbacks: LocalStreamCallbacks,
    signal?: AbortSignal
  ): Promise<{ text: string; durationMs: number; totalTokens: number }>;
}

interface WebLLMEngineLike {
  chat: {
    completions: {
      create: (opts: Record<string, unknown>) => Promise<
        AsyncIterable<{
          choices?: Array<{ delta?: { content?: string } }>;
          usage?: { total_tokens?: number };
        }>
      >;
    };
  };
  unload: () => Promise<void>;
  interruptGenerate?: () => void;
}

interface ChromeLanguageModelSession {
  promptStreaming: (input: string, options?: { signal?: AbortSignal }) => AsyncIterable<string>;
  destroy?: () => void;
}

interface ChromeLanguageModelGlobal {
  availability?: () => Promise<string>;
  capabilities?: () => Promise<{ available?: string }>;
  create: (options?: Record<string, unknown>) => Promise<ChromeLanguageModelSession>;
}

export class LocalModelService implements ILocalModelService {
  private logger?: ILogger;
  private webllmEngine: WebLLMEngineLike | null = null;
  public loadedWebLLMModelId: string | null = null;
  private loadingModelPromise: Promise<void> | null = null;

  public webllmProgressObservable: IObservable<LocalModelLoadProgress>;

  constructor(config?: { logger?: ILogger }) {
    this.logger = config?.logger;
    this.webllmProgressObservable = new Observable<LocalModelLoadProgress>({
      modelId: "",
      progress: 0,
      text: "",
      status: "idle",
    });
  }

  public isWebGPUSupported(): boolean {
    return typeof navigator !== "undefined" && "gpu" in navigator;
  }

  public getWebLLMProgress(): LocalModelLoadProgress {
    return this.webllmProgressObservable.getSnapshot();
  }

  public async hasWebLLMModelCached(modelId: string): Promise<boolean> {
    if (typeof window === "undefined") return false;
    try {
      const webllm = await import("@mlc-ai/web-llm");
      return await webllm.hasModelInCache(modelId);
    } catch {
      return false;
    }
  }

  public async loadWebLLMModel(modelId: string): Promise<void> {
    if (!this.isWebGPUSupported()) {
      const errMsg = "WebGPU is not supported in this browser. Try Chrome, Edge, or Safari 18+ on a WebGPU-capable device, or connect a local Ollama server.";
      this.webllmProgressObservable.notify({
        modelId,
        progress: 0,
        text: errMsg,
        status: "error",
        error: errMsg,
      });
      throw new Error(errMsg);
    }

    if (this.webllmEngine && this.loadedWebLLMModelId === modelId) {
      this.webllmProgressObservable.notify({
        modelId,
        progress: 1,
        text: `${modelId} ready on WebGPU`,
        status: "ready",
      });
      return;
    }

    if (this.loadingModelPromise) {
      try {
        await this.loadingModelPromise;
      } catch {
        // Prior model load failed; allow loading the requested model
      }
      if (this.loadedWebLLMModelId === modelId) return;
    }

    this.loadingModelPromise = (async () => {
      try {
        if (this.webllmEngine) {
          await this.webllmEngine.unload();
          this.webllmEngine = null;
          this.loadedWebLLMModelId = null;
        }

        this.webllmProgressObservable.notify({
          modelId,
          progress: 0.02,
          text: `Initializing WebGPU runtime for ${modelId}...`,
          status: "loading",
        });

        const webllm = await import("@mlc-ai/web-llm");
        const engine = await webllm.CreateMLCEngine(modelId, {
          initProgressCallback: (report) => {
            this.webllmProgressObservable.notify({
              modelId,
              progress: typeof report.progress === "number" ? report.progress : 0,
              text: report.text || "Loading model weights...",
              status: report.progress >= 1 ? "ready" : "loading",
            });
          },
        });

        this.webllmEngine = engine as unknown as WebLLMEngineLike;
        this.loadedWebLLMModelId = modelId;
        this.webllmProgressObservable.notify({
          modelId,
          progress: 1,
          text: `${modelId} loaded on-device`,
          status: "ready",
        });
      } catch (err: unknown) {
        const errMsg = getErrorMessage(err) || "Failed to initialize WebGPU model.";
        this.logger?.error("WebLLM initialization failed", err);
        this.webllmProgressObservable.notify({
          modelId,
          progress: 0,
          text: errMsg,
          status: "error",
          error: errMsg,
        });
        throw err;
      } finally {
        this.loadingModelPromise = null;
      }
    })();

    await this.loadingModelPromise;
  }

  public async unloadWebLLMModel(): Promise<void> {
    if (this.webllmEngine) {
      await this.webllmEngine.unload();
      this.webllmEngine = null;
    }
    this.loadedWebLLMModelId = null;
    this.webllmProgressObservable.notify({
      modelId: "",
      progress: 0,
      text: "",
      status: "idle",
    });
  }

  public async deleteWebLLMCache(modelId: string): Promise<void> {
    try {
      if (this.loadedWebLLMModelId === modelId) {
        await this.unloadWebLLMModel();
      }
      const webllm = await import("@mlc-ai/web-llm");
      await webllm.deleteModelAllInfoInCache(modelId);
    } catch (err: unknown) {
      this.logger?.warn("Failed to delete WebLLM cache", err);
    }
  }

  private formatOpenAIMessages(messages: IncomingMessage[], systemInstruction?: string) {
    const formatted: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
    if (systemInstruction?.trim()) {
      formatted.push({ role: "system", content: systemInstruction.trim() });
    }
    for (const m of messages) {
      formatted.push({
        role: m.role === "model" || m.role === "assistant" ? "assistant" : "user",
        content: m.text || "",
      });
    }
    return formatted;
  }

  public async streamWebLLMChat(
    payload: GenerateRequestBody,
    callbacks: LocalStreamCallbacks,
    signal?: AbortSignal
  ): Promise<{ text: string; durationMs: number; totalTokens: number }> {
    const startTime = Date.now();
    const fallbackWebLLM = LOCAL_PROVIDER_DEFINITIONS.find((p) => p.id === "local-webllm")?.defaultModels[0]?.id || "Llama-3.2-1B-Instruct-q4f16_1-MLC";
    const modelId = payload.model || fallbackWebLLM;

    if (!this.webllmEngine || this.loadedWebLLMModelId !== modelId) {
      await this.loadWebLLMModel(modelId);
    }

    if (!this.webllmEngine) {
      throw new Error("On-device WebGPU engine could not be initialized.");
    }

    const abortHandler = () => {
      try {
        this.webllmEngine?.interruptGenerate?.();
      } catch {
        // ignore
      }
    };
    signal?.addEventListener("abort", abortHandler, { once: true });

    try {
      const messages = this.formatOpenAIMessages(payload.messages, payload.systemInstruction);
      const stream = await this.webllmEngine.chat.completions.create({
        messages,
        stream: true,
        temperature: typeof payload.temperature === "number" ? Math.min(2, payload.temperature) : 0.7,
        top_p: typeof payload.topP === "number" ? payload.topP : 0.95,
        max_tokens: payload.maxOutputTokens || 2048,
        ...(payload.responseMimeType === "application/json"
          ? { response_format: { type: "json_object" } }
          : {}),
      });

      let accumulatedText = "";
      let totalTokens = 0;

      for await (const chunk of stream) {
        if (signal?.aborted) {
          throw new DOMException("Generation stopped by user.", "AbortError");
        }
        const delta = chunk.choices?.[0]?.delta?.content || "";
        if (delta) {
          accumulatedText += delta;
          callbacks.onChunk(accumulatedText);
        }
        if (chunk.usage?.total_tokens) {
          totalTokens = chunk.usage.total_tokens;
        }
      }

      if (!totalTokens && accumulatedText.length > 0) {
        totalTokens = Math.max(1, Math.round(accumulatedText.length / 4));
      }

      const durationMs = Date.now() - startTime;
      callbacks.onDone?.({ durationMs, totalTokens });
      return { text: accumulatedText, durationMs, totalTokens };
    } finally {
      signal?.removeEventListener("abort", abortHandler);
    }
  }

  private getChromeLanguageModelAPI(): ChromeLanguageModelGlobal | null {
    if (typeof window === "undefined") return null;
    const win = window as unknown as {
      LanguageModel?: ChromeLanguageModelGlobal;
      ai?: { languageModel?: ChromeLanguageModelGlobal };
    };
    return win.LanguageModel || win.ai?.languageModel || null;
  }

  public async checkBrowserAIAvailability(): Promise<BrowserAIAvailability> {
    const api = this.getChromeLanguageModelAPI();
    if (!api) return "unsupported";
    try {
      if (typeof api.availability === "function") {
        const status = await api.availability();
        if (status === "available" || status === "readily") return "readily";
        if (status === "downloadable" || status === "downloading" || status === "after-download") {
          return "after-download";
        }
        return "no";
      }
      if (typeof api.capabilities === "function") {
        const caps = await api.capabilities();
        if (caps?.available === "readily") return "readily";
        if (caps?.available === "after-download") return "after-download";
        return "no";
      }
      return "readily";
    } catch {
      return "unsupported";
    }
  }

  public async streamBrowserAIChat(
    payload: GenerateRequestBody,
    callbacks: LocalStreamCallbacks,
    signal?: AbortSignal
  ): Promise<{ text: string; durationMs: number; totalTokens: number }> {
    const startTime = Date.now();
    const api = this.getChromeLanguageModelAPI();
    if (!api) {
      throw new Error(
        "Browser Built-in AI (LanguageModel API) is not available in this browser. Enable Chrome's Prompt API flag or use WebGPU On-Device / Ollama instead."
      );
    }

    const session = await api.create({
      ...(payload.systemInstruction?.trim() ? { systemPrompt: payload.systemInstruction.trim() } : {}),
      ...(typeof payload.temperature === "number" ? { temperature: Math.min(2, payload.temperature) } : {}),
      ...(typeof payload.topK === "number" ? { topK: payload.topK } : {}),
    });

    try {
      const conversationPrompt = payload.messages
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text || ""}`)
        .join("\n\n");

      const stream = session.promptStreaming(conversationPrompt, { signal });
      let accumulatedText = "";

      for await (const chunk of stream) {
        if (signal?.aborted) {
          throw new DOMException("Generation stopped by user.", "AbortError");
        }
        // Some Chrome builds yield cumulative text, others yield deltas
        if (chunk.startsWith(accumulatedText) && chunk.length >= accumulatedText.length) {
          accumulatedText = chunk;
        } else {
          accumulatedText += chunk;
        }
        callbacks.onChunk(accumulatedText);
      }

      const totalTokens = Math.max(1, Math.round(accumulatedText.length / 4));
      const durationMs = Date.now() - startTime;
      callbacks.onDone?.({ durationMs, totalTokens });
      return { text: accumulatedText, durationMs, totalTokens };
    } finally {
      session.destroy?.();
    }
  }

  private createLinkedTimeoutController(
    parentSignal: AbortSignal | undefined,
    timeoutMs: number,
    timeoutLabel: string
  ): {
    signal: AbortSignal;
    didTimeout: () => boolean;
    cleanup: () => void;
  } {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error(`${timeoutLabel} timed out after ${Math.round(timeoutMs / 1000)}s.`));
    }, timeoutMs);

    const onParentAbort = () => controller.abort(parentSignal?.reason);
    if (parentSignal) {
      if (parentSignal.aborted) {
        controller.abort(parentSignal.reason);
      } else {
        parentSignal.addEventListener("abort", onParentAbort, { once: true });
      }
    }

    return {
      signal: controller.signal,
      didTimeout: () => timedOut,
      cleanup: () => {
        clearTimeout(timer);
        parentSignal?.removeEventListener("abort", onParentAbort);
      },
    };
  }

  private async readChunkWithIdleTimeout(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    idleTimeoutMs: number,
    parentSignal?: AbortSignal,
    onTimeoutAbort?: () => void
  ): Promise<ReadableStreamReadResult<Uint8Array>> {
    if (parentSignal?.aborted) {
      throw new DOMException("Generation stopped by user.", "AbortError");
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      const onAbort = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new DOMException("Generation stopped by user.", "AbortError"));
      };

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        parentSignal?.removeEventListener("abort", onAbort);
        onTimeoutAbort?.();
        reject(new Error(`Local server stream stalled for ${Math.round(idleTimeoutMs / 1000)}s.`));
      }, idleTimeoutMs);

      parentSignal?.addEventListener("abort", onAbort, { once: true });

      reader
        .read()
        .then((res) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          parentSignal?.removeEventListener("abort", onAbort);
          resolve(res);
        })
        .catch((err) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          parentSignal?.removeEventListener("abort", onAbort);
          reject(err);
        });
    });
  }

  public async probeLocalServer(
    rawBaseUrl: string
  ): Promise<{ valid: boolean; models: ModelInfo[]; error?: string }> {
    const baseUrl = rawBaseUrl.trim().replace(/\/+$/, "");
    if (!baseUrl) {
      return { valid: false, models: [], error: "Local server URL is required." };
    }

    const probeCtrl = this.createLinkedTimeoutController(undefined, 15_000, "Local server probe");
    try {
      // 1. Try Ollama native /api/tags
      if (!baseUrl.endsWith("/v1")) {
        try {
          const resp = await fetch(`${baseUrl}/api/tags`, { signal: probeCtrl.signal });
          if (resp.ok) {
            const data = (await resp.json()) as {
              models?: Array<{
                name: string;
                size?: number;
                details?: { parameter_size?: string; quantization_level?: string };
              }>;
            };
            const models: ModelInfo[] = (data.models || []).map((m) => ({
              id: m.name,
              name: m.name,
              category: "Local On-Device",
              description: [m.details?.parameter_size, m.details?.quantization_level]
                .filter(Boolean)
                .join(" · ") || `Local Ollama model at ${baseUrl}`,
              contextWindow: "Local context",
              supportsVision: m.name.includes("vision") || m.name.includes("llava") || m.name.includes("gemma3"),
              supportsAudio: false,
              supportsSystemInstruction: true,
              supportsJson: true,
              providerId: "local-ollama",
              providerName: "Local Server",
              isLocal: true,
              sizeLabel: m.size ? `${(m.size / 1e9).toFixed(1)} GB` : undefined,
            }));
            return { valid: true, models };
          }
        } catch {
          // Fall through to OpenAI-compatible /v1/models
        }
      }

      // 2. Try OpenAI-compatible /v1/models (LM Studio, llama.cpp, vLLM)
      try {
        const endpoint = baseUrl.endsWith("/v1") ? `${baseUrl}/models` : `${baseUrl}/v1/models`;
        const resp = await fetch(endpoint, { signal: probeCtrl.signal });
        if (!resp.ok) {
          return {
            valid: false,
            models: [],
            error: `Local server responded with status ${resp.status}.`,
          };
        }
        const data = (await resp.json()) as { data?: Array<{ id: string }> };
        const models: ModelInfo[] = (data.data || []).map((m) => ({
          id: m.id,
          name: m.id,
          category: "Local On-Device",
          description: `Local server model hosted at ${baseUrl}.`,
          contextWindow: "Local context",
          supportsVision: false,
          supportsAudio: false,
          supportsSystemInstruction: true,
          supportsJson: true,
          providerId: "local-ollama",
          providerName: "Local Server",
          isLocal: true,
        }));
        return { valid: true, models };
      } catch (err: unknown) {
        return {
          valid: false,
          models: [],
          error: `${getErrorMessage(err)}. Ensure your local server is running and allows CORS (e.g. OLLAMA_ORIGINS="*").`,
        };
      }
    } finally {
      probeCtrl.cleanup();
    }
  }

  public async streamLocalServerChat(
    rawBaseUrl: string,
    apiKey: string | undefined,
    payload: GenerateRequestBody,
    callbacks: LocalStreamCallbacks,
    signal?: AbortSignal
  ): Promise<{ text: string; durationMs: number; totalTokens: number }> {
    const startTime = Date.now();
    const baseUrl = rawBaseUrl.trim().replace(/\/+$/, "") || "http://localhost:11434";
    const isOpenAICompat = baseUrl.endsWith("/v1");
    const CONNECT_TIMEOUT_MS = 30_000;
    const IDLE_TIMEOUT_MS = 60_000;

    if (isOpenAICompat) {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey?.trim()) {
        headers["Authorization"] = `Bearer ${apiKey.trim()}`;
      }

      const requestCtrl = new AbortController();
      let connectTimedOut = false;
      const connectTimer = setTimeout(() => {
        connectTimedOut = true;
        requestCtrl.abort(new Error(`Local server connection timed out after ${Math.round(CONNECT_TIMEOUT_MS / 1000)}s.`));
      }, CONNECT_TIMEOUT_MS);
      const onParentAbort = () => requestCtrl.abort(signal?.reason);
      if (signal) {
        if (signal.aborted) {
          requestCtrl.abort(signal.reason);
        } else {
          signal.addEventListener("abort", onParentAbort, { once: true });
        }
      }

      try {
        let resp: Response;
        try {
          resp = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers,
            signal: requestCtrl.signal,
            body: JSON.stringify({
              model: payload.model,
              messages: this.formatOpenAIMessages(payload.messages, payload.systemInstruction),
              stream: true,
              temperature: payload.temperature,
              top_p: payload.topP,
              ...(payload.maxOutputTokens ? { max_tokens: payload.maxOutputTokens } : {}),
              ...(payload.responseMimeType === "application/json"
                ? { response_format: { type: "json_object" } }
                : {}),
            }),
          });
        } catch (err) {
          if (connectTimedOut) {
            throw new Error(`Local server connection timed out after ${Math.round(CONNECT_TIMEOUT_MS / 1000)}s.`);
          }
          throw err;
        } finally {
          clearTimeout(connectTimer);
        }

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Local server error (${resp.status}): ${text}`);
        }

        const reader = resp.body?.getReader();
        if (!reader) throw new Error("Local server response stream unavailable.");

        const decoder = new TextDecoder();
        let buffer = "";
        let accumulatedText = "";
        let totalTokens = 0;

        const processSseLine = (rawLine: string) => {
          const line = rawLine.trim();
          if (!line.startsWith("data:")) return;
          const dataStr = line.slice(5).trim();
          if (!dataStr || dataStr === "[DONE]") return;
          try {
            const parsed = JSON.parse(dataStr) as {
              choices?: Array<{ delta?: { content?: string } }>;
              usage?: { total_tokens?: number };
            };
            const delta = parsed.choices?.[0]?.delta?.content || "";
            if (delta) {
              accumulatedText += delta;
              callbacks.onChunk(accumulatedText);
            }
            if (parsed.usage?.total_tokens) {
              totalTokens = parsed.usage.total_tokens;
            }
          } catch {
            // ignore partial JSON chunks
          }
        };

        try {
          while (true) {
            const { done, value } = await this.readChunkWithIdleTimeout(
              reader,
              IDLE_TIMEOUT_MS,
              requestCtrl.signal,
              () => requestCtrl.abort(new Error("Local server stream stalled"))
            );
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const rawLine of lines) {
              processSseLine(rawLine);
            }
          }

          const trailing = decoder.decode();
          if (trailing) buffer += trailing;
          if (buffer.trim()) {
            for (const rawLine of buffer.split("\n")) {
              processSseLine(rawLine);
            }
          }
        } finally {
          await reader.cancel().catch(() => {});
        }

        if (!totalTokens && accumulatedText.length > 0) {
          totalTokens = Math.max(1, Math.round(accumulatedText.length / 4));
        }
        const durationMs = Date.now() - startTime;
        callbacks.onDone?.({ durationMs, totalTokens });
        return { text: accumulatedText, durationMs, totalTokens };
      } finally {
        clearTimeout(connectTimer);
        signal?.removeEventListener("abort", onParentAbort);
      }
    }

    // Ollama native /api/chat NDJSON stream
    const ollamaMessages = payload.messages.map((m) => {
      const validImages = m.images
        ?.map((i) => i.data)
        .filter((d) => Boolean(d && d.trim().length > 0));
      return {
        role: m.role === "model" || m.role === "assistant" ? "assistant" : "user",
        content: m.text || "",
        ...(validImages && validImages.length > 0 ? { images: validImages } : {}),
      };
    });
    if (payload.systemInstruction?.trim()) {
      ollamaMessages.unshift({ role: "system", content: payload.systemInstruction.trim() });
    }

    const requestCtrl = new AbortController();
    let connectTimedOut = false;
    const connectTimer = setTimeout(() => {
      connectTimedOut = true;
      requestCtrl.abort(new Error(`Ollama connection timed out after ${Math.round(CONNECT_TIMEOUT_MS / 1000)}s.`));
    }, CONNECT_TIMEOUT_MS);
    const onParentAbort = () => requestCtrl.abort(signal?.reason);
    if (signal) {
      if (signal.aborted) {
        requestCtrl.abort(signal.reason);
      } else {
        signal.addEventListener("abort", onParentAbort, { once: true });
      }
    }

    try {
      let resp: Response;
      try {
        resp = await fetch(`${baseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: requestCtrl.signal,
          body: JSON.stringify({
            model: payload.model,
            messages: ollamaMessages,
            stream: true,
            ...(payload.responseMimeType === "application/json" ? { format: "json" } : {}),
            options: {
              temperature: payload.temperature,
              top_p: payload.topP,
              top_k: payload.topK,
              ...(payload.maxOutputTokens ? { num_predict: payload.maxOutputTokens } : {}),
            },
          }),
        });
      } catch (err) {
        if (connectTimedOut) {
          throw new Error(`Ollama connection timed out after ${Math.round(CONNECT_TIMEOUT_MS / 1000)}s.`);
        }
        throw err;
      } finally {
        clearTimeout(connectTimer);
      }

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Ollama error (${resp.status}): ${text}`);
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("Ollama response stream unavailable.");

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedText = "";
      let totalTokens = 0;

      const processNdjsonLine = (rawLine: string) => {
        const line = rawLine.trim();
        if (!line) return;
        try {
          const parsed = JSON.parse(line) as {
            message?: { content?: string };
            done?: boolean;
            eval_count?: number;
            prompt_eval_count?: number;
            error?: string;
          };
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.message?.content) {
            accumulatedText += parsed.message.content;
            callbacks.onChunk(accumulatedText);
          }
          if (parsed.done) {
            totalTokens = (parsed.prompt_eval_count || 0) + (parsed.eval_count || 0);
          }
        } catch (parseErr) {
          if (parseErr instanceof Error && !(parseErr instanceof SyntaxError)) {
            throw parseErr;
          }
        }
      };

      try {
        while (true) {
          const { done, value } = await this.readChunkWithIdleTimeout(
            reader,
            IDLE_TIMEOUT_MS,
            requestCtrl.signal,
            () => requestCtrl.abort(new Error("Ollama stream stalled"))
          );
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const rawLine of lines) {
            processNdjsonLine(rawLine);
          }
        }

        const trailing = decoder.decode();
        if (trailing) buffer += trailing;
        if (buffer.trim()) {
          for (const rawLine of buffer.split("\n")) {
            processNdjsonLine(rawLine);
          }
        }
      } finally {
        await reader.cancel().catch(() => {});
      }

      if (!totalTokens && accumulatedText.length > 0) {
        totalTokens = Math.max(1, Math.round(accumulatedText.length / 4));
      }
      const durationMs = Date.now() - startTime;
      callbacks.onDone?.({ durationMs, totalTokens });
      return { text: accumulatedText, durationMs, totalTokens };
    } finally {
      clearTimeout(connectTimer);
      signal?.removeEventListener("abort", onParentAbort);
    }
  }
}
