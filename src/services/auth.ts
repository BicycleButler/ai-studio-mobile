import { loadStoredApiKey } from "../utils/storage";

/**
 * Builds standard authentication headers for backend API proxy endpoints.
 * Automatically injects the user's custom API key if saved in client storage,
 * or allows requests to rely on the server's configured GEMINI_API_KEY.
 */

import { apiFetch } from "../utils/apiClient";

export async function fetchAuthStatus(apiKey?: string): Promise<{ valid?: boolean; error?: string; authSource?: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["x-gemini-api-key"] = apiKey;
  }
  return apiFetch<{ valid?: boolean; error?: string; authSource?: string }>("/api/auth/verify", {
    method: "POST",
    headers,
  });
}

export async function fetchServerHealth(): Promise<{ hasServerApiKey?: boolean }> {
  return apiFetch<{ hasServerApiKey?: boolean }>("/api/health");
}

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const customKey = loadStoredApiKey();
  if (customKey && customKey.trim()) {
    headers["x-gemini-api-key"] = customKey.trim();
  }
  return headers;
}
