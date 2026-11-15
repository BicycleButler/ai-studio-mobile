import { GoogleGenAI } from "@google/genai";

/**
 * Instantiates and returns a GoogleGenAI client using the provided key or
 * the environment variable GEMINI_API_KEY as a fallback.
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
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}
