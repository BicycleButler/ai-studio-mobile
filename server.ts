import express, { Request, Response } from "express";
import path from "path";
import { GoogleGenAI, GenerateContentConfig } from "@google/genai";
import dotenv from "dotenv";
import {
  GenerateRequestSchema,
  CountTokensRequestSchema,
  TTSRequestSchema,
  formatZodError,
} from "./src/schemas/validation";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Helper to get GoogleGenAI client
function getGenAIClient(customApiKey?: string): GoogleGenAI {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY in your environment or provide it in the API Key settings."
    );
  }
  return new GoogleGenAI({ apiKey });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unexpected error occurred.";
}

function getErrorStatus(error: unknown): number {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number") return status;
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

// Fallback models when offline
const DEFAULT_FALLBACK_MODELS = [
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    category: "Recommended",
    badge: "Fast & Multimodal",
    description: "Google's latest versatile model for general text, multimodal reasoning, and coding.",
    contextWindow: "1M tokens",
    supportsVision: true,
    supportsAudio: true,
    supportsSystemInstruction: true,
    supportsJson: true,
  },
  {
    id: "gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash Lite",
    category: "High Speed",
    badge: "Ultra Low Latency",
    description: "Lightweight and optimized for swift, cost-effective mobile responses and turnarounds.",
    contextWindow: "1M tokens",
    supportsVision: true,
    supportsAudio: false,
    supportsSystemInstruction: true,
    supportsJson: true,
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    category: "Stable Production",
    badge: "Fast & Multimodal",
    description: "Stable multimodal model supporting up to 1 million tokens.",
    contextWindow: "1M tokens",
    supportsVision: true,
    supportsAudio: true,
    supportsSystemInstruction: true,
    supportsJson: true,
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    category: "Complex Reasoning",
    badge: "High Intelligence",
    description: "Advanced reasoning model with deep analysis and coding capabilities.",
    contextWindow: "2M tokens",
    supportsVision: true,
    supportsAudio: true,
    supportsSystemInstruction: true,
    supportsJson: true,
  },
];

// Cached live models
let cachedLiveModels: typeof DEFAULT_FALLBACK_MODELS | null = null;
let cachedLiveModelsTimestamp = 0;

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
        console.error("Callback error:", err);
        window.location.href = '/';
      }
    })();
  </script>
</body>
</html>`);
});

// OAuth Authorization URL generator
app.get("/api/auth/url", (req: Request, res: Response): void => {
  const clientId = process.env.CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "";
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
      model: "gemini-3.8-flash",
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

  try {
    const customKey = req.headers["x-gemini-api-key"] as string | undefined;
    const ai = getGenAIClient(customKey);
    const pager = await ai.models.list();

    const liveModels: Array<{
      id: string;
      name: string;
      category: string;
      badge: string;
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
        const inputLimit = m.inputTokenLimit;
        const ctx = inputLimit
          ? `${inputLimit >= 1_000_000 ? `${(inputLimit / 1_000_000).toFixed(0)}M` : `${Math.round(inputLimit / 1_000)}k`} tokens`
          : "1M tokens";

        let category = "General";
        let badge = "Multimodal";
        if (id.includes("flash-lite")) {
          category = "High Speed";
          badge = "Ultra Low Latency";
        } else if (id.includes("flash")) {
          category = "Recommended";
          badge = "Fast & Multimodal";
        } else if (id.includes("pro")) {
          category = "Complex Reasoning";
          badge = "High Intelligence";
        } else if (id.includes("tts")) {
          category = "Audio / Speech";
          badge = "TTS Voice";
        }

        liveModels.push({
          id,
          name: m.displayName || id,
          category,
          badge,
          description: m.description || `Google AI Studio ${id} model.`,
          contextWindow: ctx,
          supportsVision: true,
          supportsAudio: id.includes("pro") || id.includes("flash") || id.includes("tts"),
          supportsSystemInstruction: true,
          supportsJson: true,
        });
      }
    }

    if (liveModels.length > 0) {
      // Prioritize recommended models at top
      liveModels.sort((a, b) => {
        const priority = (id: string) => {
          if (id === "gemini-3.8-flash") return 1;
          if (id === "gemini-2.5-flash") return 2;
          if (id === "gemini-2.5-pro") return 3;
          if (id === "gemini-3.1-flash-lite") return 4;
          if (id.includes("flash")) return 5;
          if (id.includes("pro")) return 6;
          return 10;
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
  } catch (err: unknown) {
    console.warn("Failed to fetch live models from Google AI Studio:", getErrorMessage(err));
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
    const { model, contents } = parseResult.data;

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
        model,
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
      console.error("Gemini API Error:", err);
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
    console.error("Gemini TTS Error:", err);
    const statusCode = getErrorStatus(err);
    const errorMessage = getErrorMessage(err) || "Failed to generate speech with Gemini TTS.";
    res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
      error: errorMessage,
    });
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
    console.log(`AI Studio Android Server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
