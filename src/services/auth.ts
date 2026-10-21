import { loadStoredApiKey } from "../utils/storage";

/**
 * Builds standard authentication headers for backend API proxy endpoints.
 * Automatically injects the user's custom API key if saved in client storage,
 * or allows requests to rely on the server's configured GEMINI_API_KEY.
 */

import { apiFetch } from "../utils/apiClient";


export interface IAuthService {
  fetchAuthStatus(apiKey?: string): Promise<{ valid?: boolean; error?: string; authSource?: string }>;
  fetchServerHealth(): Promise<{ hasServerApiKey?: boolean }>;
  getAuthHeaders(): Record<string, string>;
}

export interface AuthServiceConfig {
  apiClient?: typeof apiFetch;
  loadStoredApiKeyFn?: typeof loadStoredApiKey;
}

export class AuthService implements IAuthService {
  private fetchFn: typeof apiFetch;
  private getStoredApiKeyFn: typeof loadStoredApiKey;

  constructor(config?: AuthServiceConfig) {
    this.fetchFn = config?.apiClient || apiFetch;
    this.getStoredApiKeyFn = config?.loadStoredApiKeyFn || loadStoredApiKey;
  }

  public async fetchAuthStatus(apiKey?: string): Promise<{ valid?: boolean; error?: string; authSource?: string }> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["x-gemini-api-key"] = apiKey;
    }
    return this.fetchFn<{ valid?: boolean; error?: string; authSource?: string }>("/api/auth/verify", {
      method: "POST",
      headers,
    });
  }

  public async fetchServerHealth(): Promise<{ hasServerApiKey?: boolean }> {
    return this.fetchFn<{ hasServerApiKey?: boolean }>("/api/health");
  }

  public getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const customKey = this.getStoredApiKeyFn();
    if (customKey && customKey.trim()) {
      headers["x-gemini-api-key"] = customKey.trim();
    }
    return headers;
  }
}

export const defaultAuthService = new AuthService();

export async function fetchAuthStatus(apiKey?: string): Promise<{ valid?: boolean; error?: string; authSource?: string }> {
  return defaultAuthService.fetchAuthStatus(apiKey);
}

export async function fetchServerHealth(): Promise<{ hasServerApiKey?: boolean }> {
  return defaultAuthService.fetchServerHealth();
}

export function getAuthHeaders(): Record<string, string> {
  return defaultAuthService.getAuthHeaders();
}
