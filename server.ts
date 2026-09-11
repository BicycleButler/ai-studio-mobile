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

// Health check endpoint
app.get("/api/health", (_req: Request, res: Response): void => {
  res.json({
    status: "ok",
    hasServerApiKey: Boolean(process.env.GEMINI_API_KEY),
  });
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
      authSource: customKey ? "custom_key" : "ai_studio_secret",
      totalTokens: countResult.totalTokens,
    });
  } catch (err: unknown) {
    res.status(401).json({
      valid: false,
      error: getErrorMessage(err),
    });
  }
});

// Available models definition
const AVAILABLE_MODELS = [
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
    id: "gemini-flash-latest",
    name: "Gemini Flash (Latest)",
    category: "Latest Stable",
    badge: "Stable",
    description: "Always targets the latest recommended stable Gemini Flash release.",
    contextWindow: "1M tokens",
    supportsVision: true,
    supportsAudio: true,
    supportsSystemInstruction: true,
    supportsJson: true,
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    category: "Legacy Fast",
    badge: "2.5 Generation",
    description: "Previous generation high-speed multimodal model.",
    contextWindow: "1M tokens",
    supportsVision: true,
    supportsAudio: true,
    supportsSystemInstruction: true,
    supportsJson: true,
  },
];

// Return models list
app.get("/api/models", (_req: Request, res: Response): void => {
  res.json({ models: AVAILABLE_MODELS });
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
