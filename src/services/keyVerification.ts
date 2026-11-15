import { ITimeProvider, DefaultTimeProvider } from "../utils/timeProvider";
import { getErrorMessage } from "../utils/errorHandling";
import { KeyVerificationResult } from "../types";
import { IApiClient } from "../utils/apiClient";
import { ILogger } from "../utils/logger";
import { IClipboardService } from "./clipboardService";

// Base string patterns for dynamic regex composition
const BASE_STANDARD_GOOGLE_KEY = "AIza[0-9A-Za-z\\-_]{35}";
const BASE_AISTUDIO_PROJECT_KEY = "AQ\\.[0-9A-Za-z\\-_]{10,}";

/**
 * Standard Google API keys: `AIza` followed by 35 alphanumeric/dash/underscore characters.
 */
export const STANDARD_GOOGLE_KEY_REGEX = new RegExp(`^${BASE_STANDARD_GOOGLE_KEY}$`);

/**
 * AI Studio project keys: starting with `AQ.` followed by alphanumeric/dash/underscore characters.
 */
export const AISTUDIO_PROJECT_KEY_REGEX = new RegExp(`^${BASE_AISTUDIO_PROJECT_KEY}$`);

/**
 * Embedded search pattern to extract key from text or environment strings.
 */
const EMBEDDED_KEY_REGEX = new RegExp(`(${BASE_STANDARD_GOOGLE_KEY}|${BASE_AISTUDIO_PROJECT_KEY})`);

export interface IKeyVerificationService {
  isValidGoogleApiKeyFormat(key: string): boolean;
  detectGoogleApiKey(text: string): string | null;
  maskApiKey(key: string): string;
  verifyGoogleApiKey(apiKey: string, model?: string): Promise<KeyVerificationResult>;
  clearClipboardSafe(): Promise<boolean>;
}

export interface KeyVerificationServiceConfig {
  apiClient: IApiClient;
  logger: ILogger;
  clipboardService?: IClipboardService;
  timeProvider?: ITimeProvider;
}

export class KeyVerificationService implements IKeyVerificationService {
  private apiClient: IApiClient;
  private logger: ILogger;
  private clipboardService?: IClipboardService;
  private timeProvider: ITimeProvider;

  constructor(config: KeyVerificationServiceConfig) {
    this.apiClient = config.apiClient;
    this.logger = config.logger;
    this.clipboardService = config.clipboardService;
    this.timeProvider = config.timeProvider || new DefaultTimeProvider();
  }

  public isValidGoogleApiKeyFormat(key: string): boolean {
    const trimmed = key.trim();
    return STANDARD_GOOGLE_KEY_REGEX.test(trimmed) || AISTUDIO_PROJECT_KEY_REGEX.test(trimmed);
  }

  public detectGoogleApiKey(text: string): string | null {
    if (!text || typeof text !== "string") return null;
    const trimmed = text.trim();

    // Exact match check first
    if (this.isValidGoogleApiKeyFormat(trimmed)) {
      return trimmed;
    }

    // Embedded match inside copied configuration text (e.g. `GEMINI_API_KEY="AIza..."`)
    const match = trimmed.match(EMBEDDED_KEY_REGEX);
    if (match && match[1]) {
      return match[1];
    }

    return null;
  }

  public maskApiKey(key: string): string {
    if (!key) return "";
    const trimmed = key.trim();
    if (trimmed.length <= 8) {
      return trimmed.slice(0, 2) + "..." + trimmed.slice(-2);
    }
    return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
  }

  public async verifyGoogleApiKey(
    apiKey: string,
    model: string = "gemini-2.5-flash"
  ): Promise<KeyVerificationResult> {
    const candidate = apiKey.trim();
    if (!candidate) {
      return {
        valid: false,
        error: "No API key provided for verification.",
      };
    }

    if (!this.isValidGoogleApiKeyFormat(candidate)) {
      return {
        valid: false,
        error: "Key format does not match recognized Google AI Studio key patterns (AIza... or AQ....).",
      };
    }

    try {
      const data = await this.apiClient.fetch<KeyVerificationResult>("/api/verify-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey: candidate,
          model,
        }),
      });

      if (data.valid) {
        return {
          valid: true,
          model: data.model || model,
          totalTokens: data.totalTokens,
          verifiedAt: data.verifiedAt || this.timeProvider.now(),
        };
      }

      return {
        valid: false,
        error: data.error || "The provided API key is inactive or unauthorized by Google AI Studio.",
      };
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err) || "Network error during key authorization check.";
      return {
        valid: false,
        error: errorMsg,
      };
    }
  }

  public async clearClipboardSafe(): Promise<boolean> {
    if (this.clipboardService) {
        return this.clipboardService.writeText("");
    }
    return false;
  }
}


