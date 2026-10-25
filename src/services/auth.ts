
/**
 * Builds standard authentication headers for backend API proxy endpoints.
 * Automatically injects the user's custom API key if saved in client storage,
 * or allows requests to rely on the server's configured GEMINI_API_KEY.
 */

import { IApiClient, defaultClient } from "../utils/apiClient";



export interface IAuthService {
  fetchAuthStatus(apiKey?: string): Promise<{ valid?: boolean; error?: string; authSource?: string }>;
  fetchServerHealth(): Promise<{ hasServerApiKey?: boolean }>;
  getAuthHeaders(): Record<string, string>;
}

export interface AuthServiceConfig {
  apiClient: IApiClient;
  loadStoredApiKeyFn?: () => string;
}

export class AuthService implements IAuthService {
  private apiClient: IApiClient;
  private getStoredApiKeyFn: () => string;

  constructor(config: Required<AuthServiceConfig>) {
    this.apiClient = config.apiClient;
    this.getStoredApiKeyFn = config.loadStoredApiKeyFn || (() => "");
  }

  public async fetchAuthStatus(apiKey?: string): Promise<{ valid?: boolean; error?: string; authSource?: string }> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["x-gemini-api-key"] = apiKey;
    }
    return this.apiClient.fetch<{ valid?: boolean; error?: string; authSource?: string }>("/api/auth/verify", {
      method: "POST",
      headers,
    });
  }

  public async fetchServerHealth(): Promise<{ hasServerApiKey?: boolean }> {
    return this.apiClient.fetch<{ hasServerApiKey?: boolean }>("/api/health");
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

export const defaultAuthService = new AuthService({ apiClient: defaultClient, loadStoredApiKeyFn: () => "" });
