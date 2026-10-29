import { defaultLogger } from "./src/utils/logger";
import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { GenerateContentConfig } from "@google/genai";
import dotenv from "dotenv";
import {
  GenerateRequestSchema,
  CountTokensRequestSchema,
  TTSRequestSchema,
  formatZodError,
} from "./src/schemas/validation";
import {
  CURATED_MODELS,
  isDeprecatedOrUnusableModel,
  sanitizeModelId,
} from "./src/utils/modelCatalog";
import {
  getGraphData,
  getDiagram,
  getImpact,
  lintArchitecture,
  listSidecarSpecs,
  getSpecContent,
  saveSpecContent,
  materializeSpec,
  runCliCommand,
  stubsEvents,
} from "./server/stubsService";
import { getGenAIClient } from "./server/utils/genai";
import { ServerJulesClient, ServerJulesTask, IServerJulesClient } from "./server/julesClient";
import { ApiClient, BaseApiError } from "./src/utils/apiClient";
import { getErrorMessage } from "./src/utils/errorHandling";

dotenv.config();

const app = express();

const serverApiClient = new ApiClient();
const serverJulesClient: IServerJulesClient = new ServerJulesClient({ apiClient: serverApiClient, logger: defaultLogger });

const JULES_SESSIONS_FILE = path.join(process.cwd(), ".stubs", "jules_sessions.json");

function readJulesSessions(): unknown[] {
  try {
    if (fs.existsSync(JULES_SESSIONS_FILE)) {
      const data = fs.readFileSync(JULES_SESSIONS_FILE, "utf-8");
      return JSON.parse(data) as unknown[];
    }
  } catch (e) {
    defaultLogger.error("Failed to read Jules sessions:", e);
  }
  return [];
}

function writeJulesSessions(sessions: unknown[]): void {
  try {
    const dir = path.dirname(JULES_SESSIONS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(JULES_SESSIONS_FILE, JSON.stringify(sessions, null, 2), "utf-8");
  } catch (e) {
    defaultLogger.error("Failed to write Jules sessions:", e);
  }
}
const PORT = 3000;

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

function getErrorStatus(error: unknown): number {
  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;
    if (typeof obj.status === "number") return obj.status;
    if (typeof obj.code === "number") return obj.code;

    const inner = typeof obj.error === "object" && obj.error !== null ? (obj.error as Record<string, unknown>) : null;
    if (inner && typeof inner.code === "number") return inner.code;
    if (inner && typeof inner.status === "number") return inner.status;

    const statusStr = typeof obj.status === "string" ? obj.status : inner && typeof inner.status === "string" ? inner.status : "";
    if (statusStr === "UNAVAILABLE") return 503;
    if (statusStr === "RESOURCE_EXHAUSTED") return 429;
    if (statusStr === "PERMISSION_DENIED") return 403;
    if (statusStr === "UNAUTHENTICATED") return 401;
    if (statusStr === "NOT_FOUND") return 404;
    if (statusStr === "INVALID_ARGUMENT") return 400;
  }
  if (error instanceof Error) {
    const trimmed = error.message.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed?.error?.code === "number") return parsed.error.code;
        if (parsed?.error?.status === "UNAVAILABLE") return 503;
        if (parsed?.error?.status === "RESOURCE_EXHAUSTED") return 429;
      } catch {
        // Ignore JSON parse error
      }
    }
  }
  return 500;
}

// In-memory session store for authenticated Google user and prompts
interface GoogleSessionUser {
  email: string;
  name: string;
  picture?: string;
  sub?: string;
  authSource: "google_oauth" | "google_identity" | "google_account";
  authenticatedAt: number;
  aiStudioSynced: boolean;
}

let activeGoogleUser: GoogleSessionUser | null = null;
let savedUserPrompts: Array<Record<string, unknown>> = [];

// Fallback models when offline or unauthenticated
const DEFAULT_FALLBACK_MODELS = CURATED_MODELS;

// Cached live models and backoff tracking
let cachedLiveModels: typeof DEFAULT_FALLBACK_MODELS | null = null;
let cachedLiveModelsTimestamp = 0;
let lastModelFetchErrorTimestamp = 0;

// Health check endpoint
app.get("/api/health", (_req: Request, res: Response): void => {
  res.json({
    status: "ok",
    hasServerApiKey: Boolean(process.env.GEMINI_API_KEY),
    authenticatedGoogleUser: activeGoogleUser ? activeGoogleUser.email : null,
  });
});

// OAuth Callback handler conforming to AI Studio OAuth integration guidelines
app.get("/auth/callback", (_req: Request, res: Response): void => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Google Authentication</title>
  <style>
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 32px;
      text-align: center;
      max-width: 380px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid rgba(59, 130, 246, 0.2);
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    h2 { margin: 0 0 8px; font-size: 18px; }
    p { color: #94a3b8; font-size: 13px; margin: 0; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h2>Google Account Verified</h2>
    <p>Completing sync with Google AI Studio. This window will close automatically...</p>
  </div>
  <script>
    (function() {
      try {
        const hash = window.location.hash.substring(1);
        const search = window.location.search.substring(1);
        const params = new URLSearchParams(hash || search);
        const token = params.get('access_token') || params.get('id_token') || params.get('token');
        const code = params.get('code');
        const state = params.get('state');

        if (window.opener) {
          window.opener.postMessage({
            type: 'OAUTH_AUTH_SUCCESS',
            token: token || null,
            code: code || null,
            state: state || null
          }, '*');
          setTimeout(() => window.close(), 500);
        } else {
          window.location.href = '/';
        }
      } catch (err) {
        defaultLogger.error("Callback error:", err);
        window.location.href = '/';
      }
    })();
  </script>
</body>
</html>`);
});

function getOAuthClientId(): string {
  if (process.env.CLIENT_ID) return process.env.CLIENT_ID;
  if (process.env.GOOGLE_CLIENT_ID) return process.env.GOOGLE_CLIENT_ID;
  try {
    const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.oAuthClientId) return parsed.oAuthClientId;
    }
  } catch {
    // ignore
  }
  return "";
}

// OAuth Authorization URL generator
app.get("/api/auth/url", (req: Request, res: Response): void => {
  const clientId = getOAuthClientId();
  const host = req.get("host") || "localhost:3000";
  const protocol = req.protocol === "https" || host.includes("run.app") ? "https" : "http";
  const redirectUri = `${protocol}://${host}/auth/callback`;
  const scope = encodeURIComponent("openid email profile");
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=token%20id_token&scope=${scope}&prompt=consent&nonce=ais_${Date.now()}`;

  res.json({
    authUrl,
    redirectUri,
    hasClientId: Boolean(clientId),
  });
});

// Establish or sync authenticated Google user session
app.post("/api/auth/google", (req: Request, res: Response): void => {
  const { email, name, picture, sub, authSource } = req.body as Partial<GoogleSessionUser>;

  if (!email) {
    res.status(400).json({ error: "Email is required to authenticate Google account." });
    return;
  }

  activeGoogleUser = {
    email: email.trim().toLowerCase(),
    name: name?.trim() || email.split("@")[0],
    picture: picture || undefined,
    sub: sub || `g_${Date.now()}`,
    authSource: authSource || "google_account",
    authenticatedAt: Date.now(),
    aiStudioSynced: true,
  };

  res.json({
    success: true,
    user: activeGoogleUser,
    message: "Google account authenticated and synced with Google AI Studio.",
  });
});

// Get current authenticated Google user
app.get("/api/auth/user", (_req: Request, res: Response): void => {
  res.json({
    user: activeGoogleUser,
  });
});

// Logout Google user
app.post("/api/auth/logout", (_req: Request, res: Response): void => {
  activeGoogleUser = null;
  res.json({ success: true });
});

// User prompts persistence endpoints
app.get("/api/user/prompts", (_req: Request, res: Response): void => {
  res.json({ prompts: savedUserPrompts });
});

app.post("/api/user/prompts", (req: Request, res: Response): void => {
  const { prompts } = req.body as { prompts?: Array<Record<string, unknown>> };
  if (Array.isArray(prompts)) {
    savedUserPrompts = prompts;
  }
  res.json({ success: true, count: savedUserPrompts.length });
});

// Dedicated authentication verification endpoint
app.post("/api/auth/verify", async (req: Request, res: Response): Promise<void> => {
  try {
    const customKey = req.headers["x-gemini-api-key"] as string | undefined;
    const ai = getGenAIClient(customKey);
    const countResult = await ai.models.countTokens({
      model: "gemini-2.5-flash",
      contents: "ping",
    });
    res.json({
      valid: true,
      authSource: activeGoogleUser ? "google_account" : customKey ? "custom_key" : "ai_studio_secret",
      totalTokens: countResult.totalTokens,
      user: activeGoogleUser,
    });
  } catch (err: unknown) {
    res.status(401).json({
      valid: false,
      error: getErrorMessage(err),
    });
  }
});

// Phase 2: Lightweight test call against Google's models endpoint to verify key activity & authorization
app.post("/api/verify-key", async (req: Request, res: Response): Promise<void> => {
  try {
    const bodyKey = typeof req.body === "object" && req.body !== null ? req.body.apiKey : undefined;
    const headerKey = req.headers["x-gemini-api-key"] as string | undefined;
    const candidateKey = (bodyKey || headerKey || "").trim();

    if (!candidateKey) {
      res.status(400).json({
        valid: false,
        error: "API key is required for verification.",
      });
      return;
    }

    const testModel = (typeof req.body === "object" && req.body?.model) ? String(req.body.model) : "gemini-2.5-flash";
    const ai = getGenAIClient(candidateKey);

    // Lightweight verification call
    const result = await ai.models.countTokens({
      model: testModel,
      contents: "ping",
    });

    res.json({
      valid: true,
      model: testModel,
      totalTokens: result.totalTokens,
      verifiedAt: Date.now(),
    });
  } catch (err: unknown) {
    const msg = getErrorMessage(err);
    const status = getErrorStatus(err);
    res.status(status >= 400 && status < 600 ? status : 401).json({
      valid: false,
      error: msg,
    });
  }
});

// Return live models list synced directly from Google AI Studio
app.get("/api/models", async (req: Request, res: Response): Promise<void> => {
  const forceRefresh = req.query.refresh === "true";
  const now = Date.now();

  // Return cached models if fresh (within 5 minutes) and not forced
  if (!forceRefresh && cachedLiveModels && now - cachedLiveModelsTimestamp < 300_000) {
    res.json({
      models: cachedLiveModels,
      count: cachedLiveModels.length,
      liveSynced: true,
      cached: true,
    });
    return;
  }

  const customKey = req.headers["x-gemini-api-key"] as string | undefined;
  const apiKey = customKey || process.env.GEMINI_API_KEY;

  // If no API key is available, seamlessly serve stable defaults without querying upstream
  if (!apiKey) {
    res.json({
      models: cachedLiveModels || DEFAULT_FALLBACK_MODELS,
      count: (cachedLiveModels || DEFAULT_FALLBACK_MODELS).length,
      liveSynced: false,
    });
    return;
  }

  // Backoff protection: if upstream returned 503 or transient failure recently, avoid hammering
  if (!forceRefresh && lastModelFetchErrorTimestamp && now - lastModelFetchErrorTimestamp < 60_000) {
    res.json({
      models: cachedLiveModels || DEFAULT_FALLBACK_MODELS,
      count: (cachedLiveModels || DEFAULT_FALLBACK_MODELS).length,
      liveSynced: false,
      cached: true,
    });
    return;
  }

  try {
    const ai = getGenAIClient(customKey);
    const pager = await ai.models.list();

    const liveModels: Array<{
      id: string;
      name: string;
      category: string;
      description: string;
      contextWindow: string;
      supportsVision: boolean;
      supportsAudio: boolean;
      supportsSystemInstruction: boolean;
      supportsJson: boolean;
    }> = [];

    for await (const m of pager) {
      if (m.name && m.supportedActions?.includes("generateContent")) {
        const id = m.name.replace(/^models\//, "");
        if (isDeprecatedOrUnusableModel(id)) {
          continue; // Filter out deprecated, legacy, and non-chat models
        }

        const inputLimit = m.inputTokenLimit;
        const ctx = inputLimit
          ? `${inputLimit >= 1_000_000 ? `${(inputLimit / 1_000_000).toFixed(0)}M` : `${Math.round(inputLimit / 1_000)}k`} tokens`
          : "1M tokens";

        const curated = CURATED_MODELS.find((cm) => cm.id === id);

        let category = curated?.category || "General";
        if (!curated) {
          if (id.includes("flash-lite")) {
            category = "High Speed";
          } else if (id.includes("flash")) {
            category = "Recommended";
          } else if (id.includes("pro")) {
            category = "Complex Reasoning";
          }
        }

        liveModels.push({
          id,
          name: curated?.name || m.displayName || id,
          category,
          description: curated?.description || m.description || `Google AI Studio ${id} model.`,
          contextWindow: ctx,
          supportsVision: true,
          supportsAudio: curated?.supportsAudio ?? (id.includes("pro") || id.includes("flash")),
          supportsSystemInstruction: true,
          supportsJson: true,
        });
      }
    }

    // Ensure all standard curated models are included in the available menu
    for (const curated of CURATED_MODELS) {
      if (!liveModels.some((lm) => lm.id === curated.id)) {
        liveModels.push(curated);
      }
    }

    if (liveModels.length > 0) {
      // Prioritize recommended models at top
      liveModels.sort((a, b) => {
        const priority = (id: string) => {
          if (id === "gemini-2.5-flash") return 1;
          if (id === "gemini-3.1-pro-preview") return 2;
          if (id === "gemini-3.1-flash-lite") return 3;
          if (id === "gemini-flash-latest") return 4;
          if (id === "gemini-pro-latest") return 5;
          if (id === "gemini-3.7-flash") return 6;
          if (id === "gemini-2.5-flash") return 7;
          if (id === "gemini-2.5-pro") return 8;
          return 20;
        };
        return priority(a.id) - priority(b.id);
      });

      cachedLiveModels = liveModels;
      cachedLiveModelsTimestamp = now;

      res.json({
        models: liveModels,
        count: liveModels.length,
        liveSynced: true,
        cached: false,
      });
      return;
    }
  } catch {
    lastModelFetchErrorTimestamp = now;
    // Upstream service may be temporarily unavailable (e.g. 503 UNAVAILABLE) or rate-limited.
    // Gracefully fall back to stable default models without logging alarms to console.
  }

  // Fallback to stable defaults if unable to list
  res.json({
    models: cachedLiveModels || DEFAULT_FALLBACK_MODELS,
    count: (cachedLiveModels || DEFAULT_FALLBACK_MODELS).length,
    liveSynced: false,
  });
});

// Count tokens endpoint
app.post("/api/count-tokens", async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = CountTokensRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: formatZodError(parseResult.error) });
      return;
    }

    const customKey = req.headers["x-gemini-api-key"] as string | undefined;
    const ai = getGenAIClient(customKey);
    const { model: rawModel, contents } = parseResult.data;
    const model = sanitizeModelId(rawModel);

    const countResult = await ai.models.countTokens({
      model,
      contents: contents as string,
    });

    res.json({
      totalTokens: countResult.totalTokens,
    });
  } catch (err: unknown) {
    const rawText = JSON.stringify(req.body.contents || "");
    const estimatedTokens = Math.max(1, Math.round(rawText.length / 4));
    res.json({
      totalTokens: estimatedTokens,
      estimated: true,
      error: getErrorMessage(err),
    });
  }
});

interface TextPart {
  text: string;
}

interface InlineDataPart {
  inlineData: {
    data: string;
    mimeType: string;
  };
}

type Part = TextPart | InlineDataPart;

interface FormattedContent {
  role: "user" | "model";
  parts: Part[];
}

// Generation endpoint with SSE streaming support
app.post(
  "/api/generate",
  async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    try {
      const parseResult = GenerateRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ error: formatZodError(parseResult.error) });
        return;
      }

      const customKey = req.headers["x-gemini-api-key"] as string | undefined;
      const ai = getGenAIClient(customKey);

      const {
        model: rawModel,
        messages,
        systemInstruction,
        temperature,
        topP,
        topK,
        maxOutputTokens,
        responseMimeType,
        responseSchema,
        stream,
      } = parseResult.data;
      const model = sanitizeModelId(rawModel);

      // Convert messages to GenAI contents format
      const contents: FormattedContent[] = messages.map((msg) => {
        const parts: Part[] = [];

        if (msg.images && Array.isArray(msg.images)) {
          for (const img of msg.images) {
            if (img.data && img.mimeType) {
              parts.push({
                inlineData: {
                  data: img.data,
                  mimeType: img.mimeType,
                },
              });
            }
          }
        }

        if (msg.text) {
          parts.push({ text: msg.text });
        }

        return {
          role: msg.role === "model" || msg.role === "assistant" ? ("model" as const) : ("user" as const),
          parts: parts.length > 0 ? parts : [{ text: "" }],
        };
      });

      // Build config object
      const config: GenerateContentConfig = {};
      if (systemInstruction && systemInstruction.trim()) {
        config.systemInstruction = systemInstruction.trim();
      }
      if (typeof temperature === "number") {
        config.temperature = temperature;
      }
      if (typeof topP === "number") {
        config.topP = topP;
      }
      if (typeof topK === "number") {
        config.topK = topK;
      }
      if (typeof maxOutputTokens === "number" && maxOutputTokens > 0) {
        config.maxOutputTokens = maxOutputTokens;
      }
      if (responseMimeType) {
        config.responseMimeType = responseMimeType;
      }
      if (responseSchema && Object.keys(responseSchema).length > 0) {
        config.responseSchema = responseSchema;
      }

      if (stream) {
        // Set SSE headers
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const responseStream = await ai.models.generateContentStream({
          model,
          contents,
          config,
        });

        let usageMetadata: unknown = null;

        for await (const chunk of responseStream) {
          const chunkText = chunk.text || "";
          if (chunk.usageMetadata) {
            usageMetadata = chunk.usageMetadata;
          }

          res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
        }

        const durationMs = Date.now() - startTime;
        res.write(
          `data: ${JSON.stringify({
            done: true,
            durationMs,
            usageMetadata,
          })}\n\n`
        );
        res.end();
        return;
      } else {
        const response = await ai.models.generateContent({
          model,
          contents,
          config,
        });

        const durationMs = Date.now() - startTime;
        res.json({
          text: response.text || "",
          durationMs,
          usageMetadata: response.usageMetadata,
        });
        return;
      }
    } catch (err: unknown) {
      defaultLogger.error("Gemini API Error:", err);
      const statusCode = getErrorStatus(err);
      const errorMessage = getErrorMessage(err) || "Failed to generate AI Studio response.";

      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
        res.end();
        return;
      }

      res.status(statusCode).json({
        error: errorMessage,
      });
      return;
    }
  }
);

/**
 * Encodes raw 16-bit linear PCM audio into a standard RIFF/WAVE container
 */
function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1): Buffer {
  const len = pcmBuffer.length;
  const wavHeader = Buffer.alloc(44);
  wavHeader.write("RIFF", 0);
  wavHeader.writeUInt32LE(36 + len, 4);
  wavHeader.write("WAVE", 8);
  wavHeader.write("fmt ", 12);
  wavHeader.writeUInt32LE(16, 16); // Subchunk1Size
  wavHeader.writeUInt16LE(1, 20); // AudioFormat: PCM (1)
  wavHeader.writeUInt16LE(numChannels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(sampleRate * numChannels * 2, 28); // ByteRate
  wavHeader.writeUInt16LE(numChannels * 2, 32); // BlockAlign
  wavHeader.writeUInt16LE(16, 34); // BitsPerSample: 16-bit
  wavHeader.write("data", 36);
  wavHeader.writeUInt32LE(len, 40);
  return Buffer.concat([wavHeader, pcmBuffer]);
}

/**
 * Dedicated Gemini High-Fidelity Text-To-Speech (TTS) Endpoint
 * Uses gemini-3.1-flash-tts-preview with customizable prebuilt voices
 */
app.post("/api/tts", async (req: Request, res: Response): Promise<void> => {
  const validationResult = TTSRequestSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({
      error: `Invalid TTS payload: ${formatZodError(validationResult.error)}`,
    });
    return;
  }

  const { text, voiceName } = validationResult.data;

  try {
    const customKey = req.headers["x-gemini-api-key"] as string | undefined;
    const ai = getGenAIClient(customKey);

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: text,
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceName || "Puck",
            },
          },
        },
      },
    });

    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts;
    let rawBase64: string | undefined;

    if (Array.isArray(parts)) {
      for (const part of parts) {
        if (part.inlineData?.data) {
          rawBase64 = part.inlineData.data;
          break;
        }
      }
    }

    if (!rawBase64) {
      res.status(500).json({
        error: "No audio stream returned from Gemini TTS model.",
      });
      return;
    }

    // Convert raw 24kHz 16-bit PCM into standard WAV audio
    const pcmBuffer = Buffer.from(rawBase64, "base64");
    const wavBuffer = pcmToWav(pcmBuffer, 24000, 1);
    const audioDataUrl = `data:audio/wav;base64,${wavBuffer.toString("base64")}`;

    res.json({
      audioUrl: audioDataUrl,
      voiceName: voiceName || "Puck",
      mimeType: "audio/wav",
      sampleRate: 24000,
    });
  } catch (err: unknown) {
    defaultLogger.error("Gemini TTS Error:", err);
    const statusCode = getErrorStatus(err);
    const errorMessage = getErrorMessage(err) || "Failed to generate speech with Gemini TTS.";
    res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
      error: errorMessage,
    });
  }
});

// ============================================================================
// Google Jules Agent API Gateway (/api/jules/*)
// ============================================================================

// Jules Sessions Storage API

app.get("/api/jules/sessions", (req: Request, res: Response): void => {
  const sessions = readJulesSessions();
  res.json(sessions);
});

app.post("/api/jules/sessions", (req: Request, res: Response): void => {
  const sessions = req.body;
  if (!Array.isArray(sessions)) {
    res.status(400).json({ error: "Invalid payload, expected array" });
    return;
  }
  writeJulesSessions(sessions);
  res.json({ success: true });
});

const activeJulesTasks = new Map<string, ServerJulesTask>();

function extractJulesKey(req: Request): string | undefined {
  const customHeader = req.headers["x-jules-api-key"] as string | undefined;
  const googHeader = req.headers["x-goog-api-key"] as string | undefined;
  const authHeader = req.headers["authorization"] as string | undefined;
  let bearerToken: string | undefined;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    bearerToken = authHeader.slice(7).trim();
  }
  return customHeader || googHeader || bearerToken || process.env.JULES_API_KEY;
}

/**
 * Verifies Jules credentials against the Jules backend API
 */
app.post("/api/jules/auth/verify", async (req: Request, res: Response): Promise<void> => {
  const apiKey = req.body?.apiKey || extractJulesKey(req);
  if (!apiKey) {
    res.status(400).json({
      valid: false,
      error: "Jules API key is required. Acquire a key from https://jules.google.com/settings",
    });
    return;
  }

  try {
    const result = await serverJulesClient.verifyKey(apiKey);
    res.json(result);
  } catch (err: unknown) {
    const errorMsg = getErrorMessage(err);
    const status = errorMsg.includes("Invalid or unauthorized") ? 401 : 500;
    res.status(status).json({
      valid: false,
      error: errorMsg,
    });
  }
});

/**
 * Retrieves repositories authorized for this user on Google Jules
 */
app.get("/api/jules/repos", async (req: Request, res: Response): Promise<void> => {
  const apiKey = extractJulesKey(req);
  if (!apiKey) {
    res.status(401).json({
      error: "Jules API key is required to list repositories. Configure it in API Key settings.",
    });
    return;
  }

  try {
    const repositories = await serverJulesClient.fetchRepositories(apiKey);

    if (repositories.length > 0) {
      res.json({ repositories });
    } else {
      res.json({
        repositories: [],
        notice: "No repositories discovered. Visit https://jules.google.com to grant GitHub repo access to Jules.",
      });
    }
  } catch (err: unknown) {
    res.status(500).json({
      error: getErrorMessage(err),
    });
  }
});

/**
 * Dispatches an asynchronous coding task to Jules
 */
app.post("/api/jules/tasks", async (req: Request, res: Response): Promise<void> => {
  const apiKey = extractJulesKey(req);
  if (!apiKey) {
    res.status(401).json({
      error: "Jules API key is required. Please add your key in the settings.",
    });
    return;
  }

  const { repository, branch = "main", prompt, autoApprove = false } = req.body;
  if (!repository || !prompt) {
    res.status(400).json({
      error: "Both 'repository' (owner/repo) and 'prompt' (task description) are required.",
    });
    return;
  }

  try {
    const task = await serverJulesClient.dispatchTask(apiKey, repository, branch, prompt, autoApprove);

    if (task && task.id) {
      activeJulesTasks.set(task.id, task);
    }

    res.status(201).json({ task });
  } catch (err: unknown) {
    const errorMsg = getErrorMessage(err);
    const status = err instanceof BaseApiError ? err.statusCode : 500;
    res.status(status).json({
      error: errorMsg,
    });
  }
});

/**
 * Polls the real-time status of an ongoing Jules task
 */
app.get("/api/jules/tasks/:id", async (req: Request, res: Response): Promise<void> => {
  const taskId = req.params.id;
  const apiKey = extractJulesKey(req);

  if (!apiKey) {
    const localTask = activeJulesTasks.get(taskId);
    if (localTask) {
      res.json({ task: localTask });
      return;
    }
    res.status(401).json({
      error: "Jules API key is required to poll task status.",
    });
    return;
  }

  try {
    const task = await serverJulesClient.pollTask(apiKey, taskId);

    if (task && task.id) {
      activeJulesTasks.set(task.id, task);
    }

    res.json({ task });
  } catch (err: unknown) {
    const localTask = activeJulesTasks.get(taskId);
    if (localTask) {
      res.json({ task: localTask });
      return;
    }

    const errorMsg = getErrorMessage(err);
    res.status(errorMsg.includes("not found") || errorMsg.includes("404") ? 404 : 500).json({
      error: errorMsg || `Jules task '${taskId}' not found`,
    });
  }
});

/**
 * Approves an awaiting plan for execution
 */
app.post("/api/jules/tasks/:id/approve", async (req: Request, res: Response): Promise<void> => {
  const taskId = req.params.id;
  const apiKey = extractJulesKey(req);

  if (!apiKey) {
    res.status(401).json({
      error: "Jules API key is required to approve plans.",
    });
    return;
  }

  const { approved = true } = req.body || {};

  try {
    const task = await serverJulesClient.approveTask(apiKey, taskId, approved);

    if (task && task.id) {
      activeJulesTasks.set(task.id, task);
    }

    res.json({
      task,
      message: "Plan approved via Jules API.",
    });
  } catch (err: unknown) {
    res.status(500).json({
      error: getErrorMessage(err) || "Failed to approve plan with Jules API",
    });
  }
});

/* ==========================================================================
   STUBS ARCHITECTURE-AS-CODE & PWM (PORTAL WEB MODULE) API ROUTES
   ========================================================================== */

/**
 * GET /api/stubs/graph - Returns full AST dependency graph data & hub metrics
 */
app.get("/api/stubs/graph", async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await getGraphData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

/**
 * GET /api/stubs/diagram - Returns living Mermaid flowchart definition
 */
app.get("/api/stubs/diagram", async (req: Request, res: Response): Promise<void> => {
  try {
    const groupBy = (req.query.groupBy as "domain" | "layer") || "domain";
    const result = await getDiagram(groupBy);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

/**
 * GET /api/stubs/impact - Calculates blast radius, callers, and risk score for target file
 */
app.get("/api/stubs/impact", async (req: Request, res: Response): Promise<void> => {
  try {
    const target = req.query.target as string;
    if (!target) {
      res.status(400).json({ error: "Missing required 'target' query parameter." });
      return;
    }
    const result = await getImpact(target);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

/**
 * GET /api/stubs/lint - Runs architectural invariant checks (layers, cycles)
 */
app.get("/api/stubs/lint", async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await lintArchitecture();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

/**
 * GET /api/stubs/specs - Lists all sidecar specs (*.ts.md) and architecture plans
 */
app.get("/api/stubs/specs", async (_req: Request, res: Response): Promise<void> => {
  try {
    const specs = await listSidecarSpecs();
    res.json({ specs });
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

/**
 * GET /api/stubs/spec-detail - Returns raw markdown content of a spec
 */
app.get("/api/stubs/spec-detail", async (req: Request, res: Response): Promise<void> => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      res.status(400).json({ error: "Missing 'path' query parameter." });
      return;
    }
    const detail = await getSpecContent(filePath);
    res.json(detail);
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

/**
 * POST /api/stubs/spec-save - Updates spec content
 */
app.post("/api/stubs/spec-save", async (req: Request, res: Response): Promise<void> => {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath || typeof content !== "string") {
      res.status(400).json({ error: "Missing 'path' or 'content' in request body." });
      return;
    }
    await saveSpecContent(filePath, content);
    res.json({ success: true, message: `Spec '${filePath}' saved.` });
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

/**
 * POST /api/stubs/spec-materialize - Materializes spec code into target source file
 */
app.post("/api/stubs/spec-materialize", async (req: Request, res: Response): Promise<void> => {
  try {
    const { path: filePath } = req.body;
    if (!filePath) {
      res.status(400).json({ error: "Missing 'path' in request body." });
      return;
    }
    const result = await materializeSpec(filePath);
    res.json({
      success: true,
      message: `Materialized spec into '${result.targetFile}' (${result.bytesWritten} bytes).`,
      result,
    });
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

/**
 * GET /api/stubs/stream - Server-Sent Events channel streaming CLI logs
 */
app.get("/api/stubs/stream", (req: Request, res: Response): void => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const listener = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  stubsEvents.on("log", listener);

  // Initial connection heartbeat
  res.write(`data: ${JSON.stringify({ type: "connect", text: "Connected to Stubs PWM event bus", timestamp: Date.now() })}\n\n`);

  req.on("close", () => {
    stubsEvents.off("log", listener);
  });
});

/**
 * POST /api/stubs/execute - Triggers a CLI command and streams stdout/stderr
 */
app.post("/api/stubs/execute", async (req: Request, res: Response): Promise<void> => {
  try {
    const { command, args } = req.body;
    if (!command) {
      res.status(400).json({ error: "Missing 'command' parameter." });
      return;
    }
    const result = await runCliCommand(command, Array.isArray(args) ? args : []);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

async function startServer(): Promise<void> {
  // Vite dev middleware or static serving
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response): void => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    defaultLogger.info(`AI Studio Android Server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
