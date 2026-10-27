import { extractMessageFromUnknown } from "./errorHandling";

export const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504, 0]);

export class BaseApiError extends Error {
  public statusCode: number;
  public headers?: Record<string, string>;
  public endpoint?: string;
  public rawData?: unknown;

  constructor(message: string, statusCode: number, headers?: Record<string, string>, endpoint?: string, rawData?: unknown) {
    super(message);
    this.name = "BaseApiError";
    this.statusCode = statusCode;
    this.headers = headers;
    this.endpoint = endpoint;
    this.rawData = rawData;
  }

  static fromResponse(message: string, statusCode: number, headers?: Record<string, string>, endpoint?: string, rawData?: unknown): BaseApiError {
    return new BaseApiError(message, statusCode, headers, endpoint, rawData);
  }

  public isRetryable(): boolean {
    return RETRYABLE_STATUS_CODES.has(this.statusCode);
  }
}

export function isAbortError(err: unknown): boolean {
  if (err instanceof Error && err.name === "AbortError") return true;
  if (typeof DOMException !== "undefined" && err instanceof DOMException && err.name === "AbortError") return true;
  return false;
}

export async function parseErrorResponse(res: Response, defaultErrorMessage: string): Promise<{ errorMessage: string; headers: Record<string, string>; rawData?: unknown }> {
  const headers: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let errorMessage = defaultErrorMessage;
  let rawData: unknown;

  try {
    const contentType = res.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const err = await res.json();
      rawData = err;
      errorMessage = extractMessageFromUnknown(err) || res.statusText || defaultErrorMessage;
    } else {
      const text = await res.text();
      rawData = text;
      errorMessage = text || res.statusText || defaultErrorMessage;
    }
  } catch {
    errorMessage = res.statusText || defaultErrorMessage;
  }
  return { errorMessage, headers, rawData };
}
