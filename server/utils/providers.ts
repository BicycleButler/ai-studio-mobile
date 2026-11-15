import { Response as ExpressResponse } from "express";
import net from "node:net";
import dns from "node:dns/promises";
import { IncomingMessage, ModelInfo, ModelProviderId } from "../../src/types";
import { getProviderDefinition } from "../../src/utils/providerCatalog";
import { getErrorMessage } from "../../src/utils/errorHandling";

export interface ProviderRequestContext {
  providerId: ModelProviderId;
  apiKey?: string;
  baseUrl?: string;
  signal?: AbortSignal;
}

export interface ProviderGeneratePayload {
  model: string;
  messages: IncomingMessage[];
  systemInstruction?: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  stream?: boolean;
}

const PROBE_TIMEOUT_MS = 20_000;
const STREAM_CONNECT_TIMEOUT_MS = 30_000;
const STREAM_IDLE_TIMEOUT_MS = 60_000;

function combineSignals(signals: Array<AbortSignal | undefined>): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const cleanups: Array<() => void> = [];

  for (const sig of signals) {
    if (!sig) continue;
    if (sig.aborted) {
      controller.abort(sig.reason);
      break;
    }
    const onAbort = () => controller.abort(sig.reason);
    sig.addEventListener("abort", onAbort, { once: true });
    cleanups.push(() => sig.removeEventListener("abort", onAbort));
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      for (const fn of cleanups) fn();
    },
  };
}

function createTimeoutController(parentSignal: AbortSignal | undefined, timeoutMs: number): {
  signal: AbortSignal;
  reset: () => void;
  cleanup: () => void;
} {
  const timeoutCtrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const arm = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timeoutCtrl.abort(new Error(`Upstream request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  };

  arm();
  const combined = combineSignals([parentSignal, timeoutCtrl.signal]);

  return {
    signal: combined.signal,
    reset: arm,
    cleanup: () => {
      if (timer) clearTimeout(timer);
      combined.cleanup();
    },
  };
}

async function readChunkWithIdleTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  idleTimeoutMs: number,
  parentSignal?: AbortSignal,
  onTimeoutAbort?: () => void
): Promise<ReadableStreamReadResult<Uint8Array>> {
  if (parentSignal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const onAbort = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      parentSignal?.removeEventListener("abort", onAbort);
      onTimeoutAbort?.();
      reject(new Error(`Upstream stream stalled for ${idleTimeoutMs}ms`));
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

async function readResponseWithTimeout<T>(
  readFn: () => Promise<T>,
  timeoutMs: number,
  onTimeout: () => void
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const op = readFn();
  op.catch(() => {});
  try {
    return await Promise.race([
      op,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          try {
            onTimeout();
          } catch {
            // ignore abort error
          }
          reject(new Error(`Upstream response body timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function normalizeBaseUrl(rawUrl: string | undefined, providerId: ModelProviderId): string {
  const def = getProviderDefinition(providerId);
  const fallback = def?.defaultBaseUrl || "";
  const url = (rawUrl || fallback).trim().replace(/\/+$/, "");
  return url;
}

const METADATA_HOSTNAMES = new Set([
  "metadata.google.internal",
  "metadata.goog",
  "metadata",
  "169.254.169.254",
  "100.100.100.200",
  "fd00:ec2::254",
]);

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet < 0 || octet > 255) return null;
    value = (value << 8) | octet;
  }
  return value >>> 0;
}

function isMetadataIp(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized.startsWith("::ffff:")) {
    return isMetadataIp(normalized.slice(7));
  }
  if (normalized === "fd00:ec2::254") return true;
  if (net.isIPv4(normalized)) {
    const n = ipv4ToInt(normalized);
    if (n === null) return true;
    // 169.254.0.0/16 link-local / cloud metadata
    if ((n & 0xffff0000) === 0xa9fe0000) return true;
    // 100.100.100.200 (Alibaba metadata)
    if (normalized === "100.100.100.200") return true;
  }
  return false;
}

function isPrivateOrLoopbackIp(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized.startsWith("::ffff:")) {
    return isPrivateOrLoopbackIp(normalized.slice(7));
  }
  if (net.isIPv4(normalized)) {
    const n = ipv4ToInt(normalized);
    if (n === null) return true;
    if ((n & 0xff000000) === 0x00000000) return true; // 0.0.0.0/8
    if ((n & 0xff000000) === 0x0a000000) return true; // 10.0.0.0/8
    if ((n & 0xffc00000) === 0x64400000) return true; // 100.64.0.0/10 (CGNAT)
    if ((n & 0xff000000) === 0x7f000000) return true; // 127.0.0.0/8
    if ((n & 0xffff0000) === 0xa9fe0000) return true; // 169.254.0.0/16
    if ((n & 0xfff00000) === 0xac100000) return true; // 172.16.0.0/12
    if ((n & 0xffff0000) === 0xc0a80000) return true; // 192.168.0.0/16
    if ((n & 0xffff0000) === 0xc6120000) return true; // 198.18.0.0/15
    if ((n & 0xf0000000) === 0xe0000000) return true; // multicast/reserved >=224.0.0.0
    return false;
  }
  if (net.isIPv6(normalized)) {
    if (normalized === "::" || normalized === "::1") return true;
    if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
      return true; // fe80::/10 link-local
    }
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
      return true; // fc00::/7 ULA
    }
    if (normalized.startsWith("ff")) {
      return true; // multicast
    }
    return false;
  }
  return false;
}

export function validateProviderBaseUrl(
  rawUrl: string | undefined,
  providerId: ModelProviderId
): { ok: true; url: string } | { ok: false; error: string } {
  const url = normalizeBaseUrl(rawUrl, providerId);
  if (!url) {
    return { ok: false, error: `Base URL is required for ${providerId}.` };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: "Invalid provider base URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Only HTTP and HTTPS provider URLs are permitted." };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, error: "Embedded credentials in provider URL are not permitted." };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!hostname) {
    return { ok: false, error: "Provider base URL must include a hostname." };
  }

  if (METADATA_HOSTNAMES.has(hostname) || isMetadataIp(hostname)) {
    return { ok: false, error: "Access to cloud metadata or link-local addresses is blocked." };
  }

  if (providerId !== "local-ollama") {
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    ) {
      return { ok: false, error: "Private or local hostnames are not permitted for remote providers." };
    }
    if (net.isIP(hostname) && isPrivateOrLoopbackIp(hostname)) {
      return { ok: false, error: "Private, loopback, or reserved IP addresses are not permitted for remote providers." };
    }
  }

  return { ok: true, url: url };
}

async function assertSafeResolvedHost(url: string, providerId: ModelProviderId): Promise<void> {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (net.isIP(hostname)) return;

  try {
    const records = await dns.lookup(hostname, { all: true });
    for (const rec of records) {
      if (isMetadataIp(rec.address)) {
        const err = new Error("Resolved provider address points to a blocked metadata endpoint.") as Error & { status?: number };
        err.status = 400;
        throw err;
      }
      if (providerId !== "local-ollama" && isPrivateOrLoopbackIp(rec.address)) {
        const err = new Error("Resolved provider address points to a private or loopback network.") as Error & { status?: number };
        err.status = 400;
        throw err;
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("Resolved provider address")) {
      throw err;
    }
    // Let fetch handle actual DNS/network failure if lookup is unavailable
  }
}

function buildOpenAICompatibleEndpoint(baseUrl: string, suffix: string): string {
  const clean = baseUrl.replace(/\/+$/, "");
  if (clean.endsWith("/v1") || clean.endsWith("/openai/v1") || clean.endsWith("/api/v1")) {
    return `${clean}${suffix}`;
  }
  return `${clean}/v1${suffix}`;
}

export function isValidOpenAIChatModelId(id: string, providerId: ModelProviderId): boolean {
  const lower = id.toLowerCase();
  if (
    lower.includes("embedding") ||
    lower.includes("whisper") ||
    lower.includes("tts") ||
    lower.includes("dall-e") ||
    lower.includes("moderation") ||
    lower.includes("realtime") ||
    lower.includes("transcribe") ||
    lower.includes("sora") ||
    lower.includes("babbage") ||
    lower.includes("davinci")
  ) {
    return false;
  }
  if (providerId === "openai") {
    return (
      lower.startsWith("gpt-") ||
      lower.startsWith("o1") ||
      lower.startsWith("o3") ||
      lower.startsWith("o4") ||
      lower.startsWith("chatgpt-")
    );
  }
  return true;
}

export async function discoverProviderModels(
  ctx: ProviderRequestContext
): Promise<{ valid: boolean; models: ModelInfo[]; error?: string }> {
  const { providerId, apiKey, baseUrl: rawBaseUrl } = ctx;
  const def = getProviderDefinition(providerId);
  const validated = validateProviderBaseUrl(rawBaseUrl, providerId);

  if (def?.requiresApiKey && !apiKey?.trim()) {
    return { valid: false, models: [], error: `API key is required for ${def.name}.` };
  }

  if (!validated.ok) {
    return { valid: false, models: [], error: validated.error };
  }
  const baseUrl = validated.url;

  const timeout = createTimeoutController(ctx.signal, PROBE_TIMEOUT_MS);
  try {
    await assertSafeResolvedHost(baseUrl, providerId);
    if (providerId === "anthropic") {
      const headers: Record<string, string> = {
        "x-api-key": apiKey!.trim(),
        "anthropic-version": "2023-06-01",
      };
      const modelsUrl = `${baseUrl.replace(/\/v1$/, "")}/v1/models`;
      const resp = await fetch(modelsUrl, { headers, signal: timeout.signal, redirect: "error" });
      if (resp.ok) {
        const json = (await resp.json()) as {
          data?: Array<{ id: string; display_name?: string; created_at?: string }>;
        };
        const discovered: ModelInfo[] = (json.data || []).map((m) => {
          const curated = def?.defaultModels.find((cm) => cm.id === m.id);
          return {
            id: m.id,
            name: curated?.name || m.display_name || m.id,
            category: curated?.category || "Anthropic",
            description: curated?.description || `Anthropic Claude model (${m.id}).`,
            contextWindow: curated?.contextWindow || "200k tokens",
            supportsVision: true,
            supportsAudio: false,
            supportsSystemInstruction: true,
            supportsJson: false,
            providerId: "anthropic",
            providerName: "Anthropic",
          };
        });
        return {
          valid: true,
          models: discovered.length > 0 ? discovered : (def?.defaultModels || []),
        };
      }

      const errText = await resp.text();
      if (resp.status === 401 || resp.status === 403) {
        return { valid: false, models: [], error: `Anthropic authentication failed (${resp.status}): ${errText}` };
      }
      // Fallback: some proxies don't expose /v1/models
      return {
        valid: false,
        models: [],
        error: `Anthropic endpoint returned ${resp.status}: ${errText}`,
      };
    }

    if (providerId === "local-ollama") {
      // Try Ollama native /api/tags first unless baseUrl explicitly targets /v1
      if (!baseUrl.endsWith("/v1")) {
        try {
          const tagsResp = await fetch(`${baseUrl}/api/tags`, { signal: timeout.signal, redirect: "error" });
          if (tagsResp.ok) {
            const data = (await tagsResp.json()) as {
              models?: Array<{
                name: string;
                model?: string;
                size?: number;
                details?: { parameter_size?: string; quantization_level?: string; family?: string };
              }>;
            };
            const models: ModelInfo[] = (data.models || []).map((m) => {
              const sizeGb = m.size ? `${(m.size / 1e9).toFixed(1)} GB` : undefined;
              const paramInfo = [m.details?.parameter_size, m.details?.quantization_level]
                .filter(Boolean)
                .join(" · ");
              return {
                id: m.name,
                name: m.name,
                category: "Local On-Device",
                description: paramInfo
                  ? `Local Ollama model (${paramInfo}).`
                  : `Local Ollama model hosted at ${baseUrl}.`,
                contextWindow: "Local context",
                supportsVision: m.name.includes("vision") || m.name.includes("llava") || m.name.includes("gemma3"),
                supportsAudio: false,
                supportsSystemInstruction: true,
                supportsJson: true,
                providerId: "local-ollama",
                providerName: "Local Server",
                isLocal: true,
                sizeLabel: sizeGb,
              };
            });
            return { valid: true, models };
          }
        } catch {
          // Fall through to OpenAI-compatible /v1/models probe (LM Studio / llama.cpp)
        }
      }
    }

    // OpenAI / OpenRouter / Groq / OpenAI-compatible / LM Studio
    const headers: Record<string, string> = {};
    if (apiKey?.trim()) {
      headers["Authorization"] = `Bearer ${apiKey.trim()}`;
    }
    if (providerId === "openrouter") {
      headers["HTTP-Referer"] = "https://aistudio-client.local";
      headers["X-Title"] = "AI Studio Multi-Provider Client";
    }

    const modelsEndpoint = buildOpenAICompatibleEndpoint(baseUrl, "/models");
    const resp = await fetch(modelsEndpoint, { headers, signal: timeout.signal, redirect: "error" });
    if (!resp.ok) {
      const errText = await resp.text();
      return {
        valid: false,
        models: [],
        error: `${def?.shortName || providerId} returned ${resp.status}: ${errText.slice(0, 240)}`,
      };
    }

    const json = (await resp.json()) as {
      data?: Array<{ id: string; name?: string; context_length?: number; description?: string }>;
    };

    const rawModels = Array.isArray(json.data) ? json.data : [];
    const filtered = rawModels
      .filter((m) => m.id && isValidOpenAIChatModelId(m.id, providerId))
      .slice(0, providerId === "openrouter" ? 50 : 100);

    const mapped: ModelInfo[] = filtered.map((m) => {
      const curated = def?.defaultModels.find((cm) => cm.id === m.id);
      const ctx = m.context_length
        ? `${Math.round(m.context_length / 1000)}k tokens`
        : curated?.contextWindow || "128k tokens";
      return {
        id: m.id,
        name: curated?.name || m.name || m.id,
        category: curated?.category || (def?.isLocal ? "Local On-Device" : def?.shortName || "Custom"),
        description:
          curated?.description ||
          m.description?.slice(0, 140) ||
          `${def?.shortName || providerId} model (${m.id}).`,
        contextWindow: ctx,
        supportsVision:
          curated?.supportsVision ??
          (m.id.includes("gpt-4o") || m.id.includes("gpt-4.1") || m.id.includes("vision")),
        supportsAudio: false,
        supportsSystemInstruction: true,
        supportsJson: true,
        providerId,
        providerName: def?.shortName || providerId,
        isLocal: def?.isLocal ?? false,
      };
    });

    // Ensure curated defaults appear first if present in discovered or if custom list is empty
    const merged: ModelInfo[] = [...mapped];
    for (const cm of def?.defaultModels || []) {
      if (!merged.some((m) => m.id === cm.id)) {
        merged.unshift(cm);
      }
    }

    return {
      valid: true,
      models: merged,
    };
  } catch (err: unknown) {
    return {
      valid: false,
      models: [],
      error: getErrorMessage(err) || `Failed to connect to ${def?.name || providerId}.`,
    };
  } finally {
    timeout.cleanup();
  }
}

function buildOpenAIMessages(
  messages: IncomingMessage[],
  systemInstruction?: string
): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = [];
  if (systemInstruction && systemInstruction.trim()) {
    result.push({ role: "system", content: systemInstruction.trim() });
  }

  for (const msg of messages) {
    const role = msg.role === "model" || msg.role === "assistant" ? "assistant" : "user";
    if (msg.images && msg.images.length > 0) {
      const contentParts: Array<Record<string, unknown>> = [];
      if (msg.text) {
        contentParts.push({ type: "text", text: msg.text });
      }
      for (const img of msg.images) {
        contentParts.push({
          type: "image_url",
          image_url: {
            url: `data:${img.mimeType};base64,${img.data}`,
          },
        });
      }
      result.push({ role, content: contentParts });
    } else {
      result.push({ role, content: msg.text || "" });
    }
  }
  return result;
}

function buildAnthropicMessages(
  messages: IncomingMessage[]
): Array<Record<string, unknown>> {
  return messages.map((msg) => {
    const role = msg.role === "model" || msg.role === "assistant" ? "assistant" : "user";
    if (msg.images && msg.images.length > 0 && role === "user") {
      const contentParts: Array<Record<string, unknown>> = [];
      for (const img of msg.images) {
        contentParts.push({
          type: "image",
          source: {
            type: "base64",
            media_type: img.mimeType,
            data: img.data,
          },
        });
      }
      if (msg.text) {
        contentParts.push({ type: "text", text: msg.text });
      }
      return { role, content: contentParts };
    }
    return { role, content: msg.text || "" };
  });
}

async function handleOpenAICompatibleGenerate(
  ctx: ProviderRequestContext,
  payload: ProviderGeneratePayload,
  res: ExpressResponse,
  startTime: number
): Promise<void> {
  const baseUrl = normalizeBaseUrl(ctx.baseUrl, ctx.providerId);
  const endpoint = buildOpenAICompatibleEndpoint(baseUrl, "/chat/completions");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (ctx.apiKey?.trim()) {
    headers["Authorization"] = `Bearer ${ctx.apiKey.trim()}`;
  }
  if (ctx.providerId === "openrouter") {
    headers["HTTP-Referer"] = "https://aistudio-client.local";
    headers["X-Title"] = "AI Studio Multi-Provider Client";
  }

  const isReasoningModel =
    payload.model.startsWith("o1") ||
    payload.model.startsWith("o3") ||
    payload.model.startsWith("o4");

  const body: Record<string, unknown> = {
    model: payload.model,
    messages: buildOpenAIMessages(payload.messages, payload.systemInstruction),
    stream: Boolean(payload.stream),
  };

  if (!isReasoningModel) {
    if (typeof payload.temperature === "number") body.temperature = payload.temperature;
    if (typeof payload.topP === "number") body.top_p = payload.topP;
  }
  if (typeof payload.maxOutputTokens === "number" && payload.maxOutputTokens > 0) {
    if (isReasoningModel && ctx.providerId === "openai") {
      body.max_completion_tokens = payload.maxOutputTokens;
    } else {
      body.max_tokens = payload.maxOutputTokens;
    }
  }
  if (payload.responseMimeType === "application/json") {
    body.response_format = { type: "json_object" };
  }
  if (payload.stream && ctx.providerId === "openai") {
    body.stream_options = { include_usage: true };
  }

  await assertSafeResolvedHost(baseUrl, ctx.providerId);

  const streamAbortCtrl = new AbortController();
  const streamLinked = combineSignals([ctx.signal, streamAbortCtrl.signal]);
  const connectTimeout = createTimeoutController(streamLinked.signal, STREAM_CONNECT_TIMEOUT_MS);
  let upstream: Response;
  try {
    upstream = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: connectTimeout.signal,
      redirect: "error",
    });
  } catch (err) {
    streamLinked.cleanup();
    throw err;
  } finally {
    connectTimeout.cleanup();
  }

  if (!upstream.ok) {
    try {
      const errText = await readResponseWithTimeout(
        () => upstream.text(),
        STREAM_CONNECT_TIMEOUT_MS,
        () => {
          streamAbortCtrl.abort(new Error("Upstream error body timed out"));
          void upstream.body?.cancel().catch(() => {});
        }
      );
      let msg = `Provider error (${upstream.status}): ${errText}`;
      try {
        const parsed = JSON.parse(errText) as { error?: { message?: string } };
        if (parsed?.error?.message) msg = parsed.error.message;
      } catch {
        // keep raw text
      }
      const safeStatus = upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502;
      res.status(safeStatus).json({ error: msg });
      return;
    } finally {
      streamLinked.cleanup();
    }
  }

  if (!payload.stream) {
    try {
      const json = (await readResponseWithTimeout(
        () => upstream.json(),
        STREAM_IDLE_TIMEOUT_MS,
        () => {
          streamAbortCtrl.abort(new Error("Upstream response body timed out"));
          void upstream.body?.cancel().catch(() => {});
        }
      )) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { total_tokens?: number };
      };
      const text = json.choices?.[0]?.message?.content || "";
      res.json({
        text,
        durationMs: Date.now() - startTime,
        usageMetadata: json.usage?.total_tokens
          ? { totalTokenCount: json.usage.total_tokens }
          : undefined,
      });
      return;
    } finally {
      streamLinked.cleanup();
    }
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const reader = upstream.body?.getReader();
  if (!reader) {
    res.write(`data: ${JSON.stringify({ error: "Upstream response body is empty." })}\n\n`);
    res.end();
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let totalTokenCount = 0;

  try {
    while (true) {
      if (ctx.signal?.aborted || res.writableEnded) break;
      const { done, value } = await readChunkWithIdleTimeout(
        reader,
        STREAM_IDLE_TIMEOUT_MS,
        streamLinked.signal,
        () => streamAbortCtrl.abort(new Error("Upstream OpenAI stream idle timeout"))
      );
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const processOpenAILine = (rawLine: string) => {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) return;
        const dataStr = line.slice(5).trim();
        if (!dataStr || dataStr === "[DONE]") return;
        try {
          const parsed = JSON.parse(dataStr) as {
            choices?: Array<{ delta?: { content?: string } }>;
            usage?: { total_tokens?: number };
          };
          const content = parsed.choices?.[0]?.delta?.content;
          if (content && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
          }
          if (parsed.usage?.total_tokens) {
            totalTokenCount = parsed.usage.total_tokens;
          }
        } catch {
          // ignore partial JSON chunks
        }
      };

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const rawLine of lines) {
        processOpenAILine(rawLine);
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      for (const rawLine of buffer.split("\n")) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) continue;
        const dataStr = line.slice(5).trim();
        if (!dataStr || dataStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(dataStr) as {
            choices?: Array<{ delta?: { content?: string } }>;
            usage?: { total_tokens?: number };
          };
          const content = parsed.choices?.[0]?.delta?.content;
          if (content && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
          }
          if (parsed.usage?.total_tokens) {
            totalTokenCount = parsed.usage.total_tokens;
          }
        } catch {
          // ignore trailing partial JSON
        }
      }
    }

    if (!ctx.signal?.aborted && !res.writableEnded) {
      res.write(
        `data: ${JSON.stringify({
          done: true,
          durationMs: Date.now() - startTime,
          usageMetadata: totalTokenCount ? { totalTokenCount } : null,
        })}\n\n`
      );
      res.end();
    }
  } catch (err: unknown) {
    if (!ctx.signal?.aborted && !res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: getErrorMessage(err) })}\n\n`);
      res.end();
    }
  } finally {
    streamLinked.cleanup();
    await reader.cancel().catch(() => {});
  }
}

async function handleAnthropicGenerate(
  ctx: ProviderRequestContext,
  payload: ProviderGeneratePayload,
  res: ExpressResponse,
  startTime: number
): Promise<void> {
  const baseUrl = normalizeBaseUrl(ctx.baseUrl, "anthropic").replace(/\/v1$/, "");
  const endpoint = `${baseUrl}/v1/messages`;

  const body: Record<string, unknown> = {
    model: payload.model,
    messages: buildAnthropicMessages(payload.messages),
    max_tokens: payload.maxOutputTokens || 2048,
    stream: Boolean(payload.stream),
  };

  if (payload.systemInstruction && payload.systemInstruction.trim()) {
    body.system = payload.systemInstruction.trim();
  }
  if (typeof payload.temperature === "number") {
    // Anthropic accepts temperature 0..1
    body.temperature = Math.min(1, Math.max(0, payload.temperature));
  }
  if (typeof payload.topP === "number") {
    body.top_p = payload.topP;
  }
  if (typeof payload.topK === "number") {
    body.top_k = payload.topK;
  }

  await assertSafeResolvedHost(baseUrl, ctx.providerId);

  const streamAbortCtrl = new AbortController();
  const streamLinked = combineSignals([ctx.signal, streamAbortCtrl.signal]);
  const connectTimeout = createTimeoutController(streamLinked.signal, STREAM_CONNECT_TIMEOUT_MS);
  let upstream: Response;
  try {
    upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": (ctx.apiKey || "").trim(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: connectTimeout.signal,
      redirect: "error",
    });
  } catch (err) {
    streamLinked.cleanup();
    throw err;
  } finally {
    connectTimeout.cleanup();
  }

  if (!upstream.ok) {
    try {
      const errText = await readResponseWithTimeout(
        () => upstream.text(),
        STREAM_CONNECT_TIMEOUT_MS,
        () => {
          streamAbortCtrl.abort(new Error("Anthropic error body timed out"));
          void upstream.body?.cancel().catch(() => {});
        }
      );
      let msg = `Anthropic error (${upstream.status}): ${errText}`;
      try {
        const parsed = JSON.parse(errText) as { error?: { message?: string } };
        if (parsed?.error?.message) msg = parsed.error.message;
      } catch {
        // keep raw
      }
      const safeStatus = upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502;
      res.status(safeStatus).json({ error: msg });
      return;
    } finally {
      streamLinked.cleanup();
    }
  }

  if (!payload.stream) {
    try {
      const json = (await readResponseWithTimeout(
        () => upstream.json(),
        STREAM_IDLE_TIMEOUT_MS,
        () => {
          streamAbortCtrl.abort(new Error("Anthropic response body timed out"));
          void upstream.body?.cancel().catch(() => {});
        }
      )) as {
        content?: Array<{ type: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      const text = (json.content || [])
        .filter((c) => c.type === "text" && c.text)
        .map((c) => c.text)
        .join("");
      const total = (json.usage?.input_tokens || 0) + (json.usage?.output_tokens || 0);
      res.json({
        text,
        durationMs: Date.now() - startTime,
        usageMetadata: total ? { totalTokenCount: total } : undefined,
      });
      return;
    } finally {
      streamLinked.cleanup();
    }
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const reader = upstream.body?.getReader();
  if (!reader) {
    res.write(`data: ${JSON.stringify({ error: "Upstream response body is empty." })}\n\n`);
    res.end();
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    while (true) {
      if (ctx.signal?.aborted || res.writableEnded) break;
      const { done, value } = await readChunkWithIdleTimeout(
        reader,
        STREAM_IDLE_TIMEOUT_MS,
        streamLinked.signal,
        () => streamAbortCtrl.abort(new Error("Upstream Anthropic stream idle timeout"))
      );
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) continue;
        const dataStr = line.slice(5).trim();
        if (!dataStr) continue;
        try {
          const parsed = JSON.parse(dataStr) as {
            type?: string;
            delta?: { type?: string; text?: string };
            message?: { usage?: { input_tokens?: number } };
            usage?: { output_tokens?: number };
            error?: { message?: string };
          };
          if (parsed.type === "error" && parsed.error?.message && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({ error: parsed.error.message })}\n\n`);
          }
          if (parsed.type === "content_block_delta" && parsed.delta?.text && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`);
          }
          if (parsed.message?.usage?.input_tokens) {
            inputTokens = parsed.message.usage.input_tokens;
          }
          if (parsed.usage?.output_tokens) {
            outputTokens = parsed.usage.output_tokens;
          }
        } catch {
          // ignore partial JSON chunks
        }
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      for (const rawLine of buffer.split("\n")) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) continue;
        const dataStr = line.slice(5).trim();
        if (!dataStr) continue;
        try {
          const parsed = JSON.parse(dataStr) as {
            type?: string;
            delta?: { type?: string; text?: string };
            message?: { usage?: { input_tokens?: number } };
            usage?: { output_tokens?: number };
            error?: { message?: string };
          };
          if (parsed.type === "error" && parsed.error?.message && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({ error: parsed.error.message })}\n\n`);
          }
          if (parsed.type === "content_block_delta" && parsed.delta?.text && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`);
          }
          if (parsed.message?.usage?.input_tokens) {
            inputTokens = parsed.message.usage.input_tokens;
          }
          if (parsed.usage?.output_tokens) {
            outputTokens = parsed.usage.output_tokens;
          }
        } catch {
          // ignore trailing partial JSON
        }
      }
    }

    if (!ctx.signal?.aborted && !res.writableEnded) {
      const totalTokenCount = inputTokens + outputTokens;
      res.write(
        `data: ${JSON.stringify({
          done: true,
          durationMs: Date.now() - startTime,
          usageMetadata: totalTokenCount ? { totalTokenCount } : null,
        })}\n\n`
      );
      res.end();
    }
  } catch (err: unknown) {
    if (!ctx.signal?.aborted && !res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: getErrorMessage(err) })}\n\n`);
      res.end();
    }
  } finally {
    streamLinked.cleanup();
    await reader.cancel().catch(() => {});
  }
}

async function handleOllamaGenerate(
  ctx: ProviderRequestContext,
  payload: ProviderGeneratePayload,
  res: ExpressResponse,
  startTime: number
): Promise<void> {
  const baseUrl = normalizeBaseUrl(ctx.baseUrl, "local-ollama");
  if (baseUrl.endsWith("/v1")) {
    await handleOpenAICompatibleGenerate(ctx, payload, res, startTime);
    return;
  }

  const endpoint = `${baseUrl}/api/chat`;
  const messages = buildOpenAIMessages(payload.messages, payload.systemInstruction).map((m) => {
    // Convert multimodal image_url to Ollama native images array if needed
    if (Array.isArray(m.content)) {
      const parts = m.content as Array<{ type: string; text?: string; image_url?: { url: string } }>;
      const text = parts
        .filter((p) => p.type === "text" && p.text)
        .map((p) => p.text)
        .join("\n");
      const images = parts
        .filter((p) => p.type === "image_url" && p.image_url?.url)
        .map((p) => p.image_url!.url.replace(/^data:[^;]+;base64,/, ""));
      return { role: m.role, content: text, ...(images.length > 0 ? { images } : {}) };
    }
    return m;
  });

  const body: Record<string, unknown> = {
    model: payload.model,
    messages,
    stream: Boolean(payload.stream),
    options: {
      temperature: payload.temperature,
      top_p: payload.topP,
      top_k: payload.topK,
      ...(payload.maxOutputTokens ? { num_predict: payload.maxOutputTokens } : {}),
    },
  };
  if (payload.responseMimeType === "application/json") {
    body.format = "json";
  }

  await assertSafeResolvedHost(baseUrl, "local-ollama");

  const streamAbortCtrl = new AbortController();
  const streamLinked = combineSignals([ctx.signal, streamAbortCtrl.signal]);
  const connectTimeout = createTimeoutController(streamLinked.signal, STREAM_CONNECT_TIMEOUT_MS);
  let upstream: Response;
  try {
    upstream = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: connectTimeout.signal,
      redirect: "error",
    });
  } catch (err) {
    streamLinked.cleanup();
    throw err;
  } finally {
    connectTimeout.cleanup();
  }

  if (!upstream.ok) {
    try {
      const errText = await readResponseWithTimeout(
        () => upstream.text(),
        STREAM_CONNECT_TIMEOUT_MS,
        () => {
          streamAbortCtrl.abort(new Error("Local server error body timed out"));
          void upstream.body?.cancel().catch(() => {});
        }
      );
      const safeStatus = upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502;
      res.status(safeStatus).json({ error: `Local server error (${upstream.status}): ${errText}` });
      return;
    } finally {
      streamLinked.cleanup();
    }
  }

  if (!payload.stream) {
    try {
      const json = (await readResponseWithTimeout(
        () => upstream.json(),
        STREAM_IDLE_TIMEOUT_MS,
        () => {
          streamAbortCtrl.abort(new Error("Local server response body timed out"));
          void upstream.body?.cancel().catch(() => {});
        }
      )) as {
        message?: { content?: string };
        eval_count?: number;
        prompt_eval_count?: number;
      };
      const total = (json.prompt_eval_count || 0) + (json.eval_count || 0);
      res.json({
        text: json.message?.content || "",
        durationMs: Date.now() - startTime,
        usageMetadata: total ? { totalTokenCount: total } : undefined,
      });
      return;
    } finally {
      streamLinked.cleanup();
    }
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const reader = upstream.body?.getReader();
  if (!reader) {
    res.write(`data: ${JSON.stringify({ error: "Local server stream body is empty." })}\n\n`);
    res.end();
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let totalTokenCount = 0;

  try {
    while (true) {
      if (ctx.signal?.aborted || res.writableEnded) break;
      const { done, value } = await readChunkWithIdleTimeout(
        reader,
        STREAM_IDLE_TIMEOUT_MS,
        streamLinked.signal,
        () => streamAbortCtrl.abort(new Error("Upstream Ollama stream idle timeout"))
      );
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        try {
          const parsed = JSON.parse(line) as {
            message?: { content?: string };
            done?: boolean;
            eval_count?: number;
            prompt_eval_count?: number;
            error?: string;
          };
          if (parsed.error && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({ error: parsed.error })}\n\n`);
          }
          if (parsed.message?.content && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({ text: parsed.message.content })}\n\n`);
          }
          if (parsed.done) {
            totalTokenCount = (parsed.prompt_eval_count || 0) + (parsed.eval_count || 0);
          }
        } catch {
          // ignore partial NDJSON lines
        }
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      for (const rawLine of buffer.split("\n")) {
        const line = rawLine.trim();
        if (!line) continue;
        try {
          const parsed = JSON.parse(line) as {
            message?: { content?: string };
            done?: boolean;
            eval_count?: number;
            prompt_eval_count?: number;
            error?: string;
          };
          if (parsed.error && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({ error: parsed.error })}\n\n`);
          }
          if (parsed.message?.content && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({ text: parsed.message.content })}\n\n`);
          }
          if (parsed.done) {
            totalTokenCount = (parsed.prompt_eval_count || 0) + (parsed.eval_count || 0);
          }
        } catch {
          // ignore trailing partial NDJSON
        }
      }
    }

    if (!ctx.signal?.aborted && !res.writableEnded) {
      res.write(
        `data: ${JSON.stringify({
          done: true,
          durationMs: Date.now() - startTime,
          usageMetadata: totalTokenCount ? { totalTokenCount } : null,
        })}\n\n`
      );
      res.end();
    }
  } catch (err: unknown) {
    if (!ctx.signal?.aborted && !res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: getErrorMessage(err) })}\n\n`);
      res.end();
    }
  } finally {
    streamLinked.cleanup();
    await reader.cancel().catch(() => {});
  }
}

export async function streamExternalProviderChat(
  ctx: ProviderRequestContext,
  payload: ProviderGeneratePayload,
  res: ExpressResponse,
  startTime: number
): Promise<void> {
  const validated = validateProviderBaseUrl(ctx.baseUrl, ctx.providerId);
  if (!validated.ok) {
    if (!res.headersSent) {
      res.status(400).json({ error: validated.error });
    }
    return;
  }
  const safeCtx: ProviderRequestContext = { ...ctx, baseUrl: validated.url };

  if (safeCtx.providerId === "anthropic") {
    await handleAnthropicGenerate(safeCtx, payload, res, startTime);
    return;
  }
  if (safeCtx.providerId === "local-ollama") {
    await handleOllamaGenerate(safeCtx, payload, res, startTime);
    return;
  }
  await handleOpenAICompatibleGenerate(safeCtx, payload, res, startTime);
}
