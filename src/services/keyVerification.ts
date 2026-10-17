import { getErrorMessage } from "../utils/errorHandling";
import { KeyVerificationResult } from "../types";
import { apiFetch } from "../utils/apiClient";
import { getSafeNavigatorClipboard } from "../utils/platform";

// Base string patterns for dynamic regex composition
const BASE_STANDARD_GOOGLE_KEY = "AIza[0-9A-Za-z\\-_]{35}";
const BASE_AISTUDIO_PROJECT_KEY = "AQ\\.[0-9A-Za-z\\-_]{10,}";
const BASE_JULES_PREFIXED_KEY = "jules_[0-9A-Za-z\\-_]{20,}";

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

/**
 * Jules API keys: either standard Google API keys (`AIza...`), Jules prefixed keys (`jules_...`),
 * or project keys (`AQ....`).
 */
export const JULES_KEY_REGEX = new RegExp(`^(${BASE_STANDARD_GOOGLE_KEY}|${BASE_AISTUDIO_PROJECT_KEY}|${BASE_JULES_PREFIXED_KEY})$`);

/**
 * Embedded Jules key search pattern.
 */
const EMBEDDED_JULES_KEY_REGEX = new RegExp(`(${BASE_STANDARD_GOOGLE_KEY}|${BASE_AISTUDIO_PROJECT_KEY}|${BASE_JULES_PREFIXED_KEY})`);

/**
 * Validates whether a raw candidate string strictly matches Jules API key specifications.
 */
export function isValidJulesApiKeyFormat(key: string): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  return JULES_KEY_REGEX.test(trimmed) || (trimmed.length >= 24 && /^[0-9A-Za-z\-_.]+$/.test(trimmed));
}

/**
 * Detects and extracts a valid Jules API key from clipboard text or raw input.
 */
export function detectJulesApiKey(text: string): string | null {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();

  if (isValidJulesApiKeyFormat(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(EMBEDDED_JULES_KEY_REGEX);
  if (match && match[1]) {
    return match[1];
  }

  return null;
}

/**
 * Validates whether a raw candidate string strictly matches Google API key specifications.
 */
export function isValidGoogleApiKeyFormat(key: string): boolean {
  const trimmed = key.trim();
  return STANDARD_GOOGLE_KEY_REGEX.test(trimmed) || AISTUDIO_PROJECT_KEY_REGEX.test(trimmed);
}

/**
 * Detects and extracts a valid Google API key from clipboard text or raw input.
 * Returns the extracted API key, or null if no valid pattern is found.
 */
export function detectGoogleApiKey(text: string): string | null {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();

  // Exact match check first
  if (isValidGoogleApiKeyFormat(trimmed)) {
    return trimmed;
  }

  // Embedded match inside copied configuration text (e.g. `GEMINI_API_KEY="AIza..."`)
  const match = trimmed.match(EMBEDDED_KEY_REGEX);
  if (match && match[1]) {
    return match[1];
  }

  return null;
}

/**
 * Masks an API key for safe preview, showing only the first 4 and last 4 characters.
 * Example: `AIza...89a` or `AQ....1b2`
 */
export function maskApiKey(key: string): string {
  if (!key) return "";
  const trimmed = key.trim();
  if (trimmed.length <= 8) {
    return trimmed.slice(0, 2) + "..." + trimmed.slice(-2);
  }
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

/**
 * Performs a lightweight test call against Google's models endpoint to verify that the key is active and authorized.
 */
export async function verifyGoogleApiKey(
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

  if (!isValidGoogleApiKeyFormat(candidate)) {
    return {
      valid: false,
      error: "Key format does not match recognized Google AI Studio key patterns (AIza... or AQ....).",
    };
  }

  try {
    const data = await apiFetch<KeyVerificationResult>("/api/verify-key", {
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
        verifiedAt: data.verifiedAt || Date.now(),
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

/**
 * Safely clears the device clipboard to prevent lingering credential exposure after key ingestion.
 */
export async function clearClipboardSafe(): Promise<boolean> {
  try {
    if (Boolean(getSafeNavigatorClipboard()?.writeText)) {
      await getSafeNavigatorClipboard()?.writeText("");
      return true;
    }
  } catch (err: unknown) {
    // Clipboard write may be restricted in non-gesture or sandboxed context
    console.debug("Clipboard clear skipped or restricted:", err);
  }
  return false;
}
