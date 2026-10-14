import { describe, test } from 'vitest';
// Unit tests for geminiStreamService and error formatting
import {
  GeminiApiError,
  buildHeaders,
  formatStreamError,
} from "./geminiStreamService";

describe('testStreamService', () => {
  test('main', () => {
  // 1. Test buildHeaders
  const defaultHeaders = buildHeaders();
  if (defaultHeaders["Content-Type"] !== "application/json") {
    throw new Error("Default headers missing application/json content type");
  }
  if (defaultHeaders["x-gemini-api-key"] !== undefined) {
    throw new Error("Default headers should not have api key when none provided");
  }

  const customHeaders = buildHeaders("test-custom-key-123");
  if (customHeaders["x-gemini-api-key"] !== "test-custom-key-123") {
    throw new Error("Custom headers did not include custom key correctly");
  }

  // 2. Test GeminiApiError classification
  const rateLimitErr = new GeminiApiError("Resource exhausted: quota exceeded", 429);
  if (!rateLimitErr.isQuotaError) {
    throw new Error("Expected isQuotaError to be true for 429 quota error");
  }

  const authErr = new GeminiApiError("Invalid API key provided", 403);
  if (!authErr.isAuthError) {
    throw new Error("Expected isAuthError to be true for 403 API key error");
  }

  const unavailableErr = new GeminiApiError("The service is currently unavailable.", 503);
  if (!unavailableErr.isUnavailable) {
    throw new Error("Expected isUnavailable to be true for 503 unavailable error");
  }

  // 3. Test formatStreamError
  const abortErr = new Error("AbortError");
  abortErr.name = "AbortError";
  const formattedAbort = formatStreamError(abortErr);
  if (!formattedAbort.message.includes("stopped by user")) {
    throw new Error("Expected abort error to format friendly message");
  }


  });
});
