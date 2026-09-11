import { loadStoredApiKey } from "../utils/storage";

/**
 * Builds standard authentication headers for backend API proxy endpoints.
 * Automatically injects the user's custom API key if saved in client storage,
 * or allows requests to rely on the server's configured GEMINI_API_KEY.
 */
export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const customKey = loadStoredApiKey();
  if (customKey && customKey.trim()) {
    headers["x-gemini-api-key"] = customKey.trim();
  }
  return headers;
}
