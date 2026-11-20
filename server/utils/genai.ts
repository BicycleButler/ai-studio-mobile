import crypto from "node:crypto";
import { GoogleGenAI } from "@google/genai";

const MAX_CACHED_CLIENTS = 32;
const clientCache = new Map<string, GoogleGenAI>();

function hashApiKey(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

export function clearGenAIClientCache(): void {
  clientCache.clear();
}

/**
 * Returns a cached GoogleGenAI client for the provided key (or GEMINI_API_KEY),
 * avoiding repeated client initialization overhead across requests.
 *
 * @param customApiKey - Optional custom API key provided by the client request.
 * @throws Error if no API key is available.
 */
export function getGenAIClient(customApiKey?: string): GoogleGenAI {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY in your environment or provide it in the API Key settings."
    );
  }

  const keyHash = hashApiKey(apiKey);
  const cached = clientCache.get(keyHash);
  if (cached) {
    clientCache.delete(keyHash);
    clientCache.set(keyHash, cached);
    return cached;
  }

  const client = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  if (clientCache.size >= MAX_CACHED_CLIENTS) {
    const oldestKey = clientCache.keys().next().value;
    if (oldestKey !== undefined) {
      clientCache.delete(oldestKey);
    }
  }
  clientCache.set(keyHash, client);
  return client;
}
