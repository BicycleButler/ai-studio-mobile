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
      errorMessage = err.error || err.message || res.statusText || defaultErrorMessage;
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


export const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504, 0]);

export interface RetryConfig {
  retries?: number;
  baseDelayMs?: number;
  fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

async function fetchWithRetry(url: string, options: RequestInit, _defaultErrorMessage: string = "API request failed", config: RetryConfig = {}): Promise<Response> {
  const retries = config.retries ?? 3;
  const baseDelayMs = config.baseDelayMs ?? 1000;
  const fetcher = config.fetcher ?? fetch;

  let attempt = 0;
  while (attempt < retries) {
    try {
      const res = await fetcher(url, options);
      if (res.ok || !RETRYABLE_STATUS_CODES.has(res.status)) {
        return res;
      }
      attempt++;
      if (attempt >= retries) return res;

      const delay = Math.pow(2, attempt) * baseDelayMs + Math.random() * baseDelayMs;
      await new Promise(resolve => setTimeout(resolve, delay));
    } catch (err: unknown) {
      if (isAbortError(err)) throw err;
      attempt++;
      if (attempt >= retries) throw err;

      const delay = Math.pow(2, attempt) * baseDelayMs + Math.random() * baseDelayMs;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("Max retries exceeded");
}

async function executeRequest(
  endpoint: string,
  options?: RequestInit,
  defaultErrorMessage: string = "API request failed"
): Promise<Response> {
  let res: Response;
  try {
    res = await fetchWithRetry(endpoint, options || {}, defaultErrorMessage);
  } catch (err: unknown) {
    if (isAbortError(err)) {
      throw err;
    }
    throw BaseApiError.fromResponse(err instanceof Error ? err.message : defaultErrorMessage, 0, undefined, endpoint);
  }

  if (!res.ok) {
    const { errorMessage, headers, rawData } = await parseErrorResponse(res, defaultErrorMessage);
    throw BaseApiError.fromResponse(errorMessage, res.status, headers, endpoint, rawData);
  }

  return res;
}


export type Interceptor = (url: string, options: RequestInit) => Promise<[string, RequestInit]>;

function buildUrlWithParams(endpoint: string, queryParams?: Record<string, string | number | boolean>): string {
  if (!queryParams || Object.keys(queryParams).length === 0) {
    return endpoint;
  }
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(queryParams)) {
    searchParams.append(key, String(value));
  }
  const separator = endpoint.includes('?') ? '&' : '?';
  return `${endpoint}${separator}${searchParams.toString()}`;
}

export class ApiClient {
  private interceptors: Interceptor[] = [];

  public addInterceptor(interceptor: Interceptor) {
    this.interceptors.push(interceptor);
  }

  public clearInterceptors() {
    this.interceptors = [];
  }

  private async prepareRequest(
    endpoint: string,
    options?: RequestInit,
    queryParams?: Record<string, string | number | boolean>
  ): Promise<{ url: string; fetchOptions: RequestInit }> {
    let url = buildUrlWithParams(endpoint, queryParams);
    let fetchOptions = options || {};

    for (const interceptor of this.interceptors) {
      const [newUrl, newOptions] = await interceptor(url, fetchOptions);
      url = newUrl;
      fetchOptions = newOptions;
    }

    return { url, fetchOptions };
  }

  public async fetch<T>(
    endpoint: string,
    options?: RequestInit,
    defaultErrorMessage: string = "API request failed",
    queryParams?: Record<string, string | number | boolean>
  ): Promise<T> {
    const { url, fetchOptions } = await this.prepareRequest(endpoint, options, queryParams);

    const res = await executeRequest(url, fetchOptions, defaultErrorMessage);

    if (res.status === 204) {
      return {} as T;
    }

    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return res.json() as Promise<T>;
    }

    const text = await res.text();
    if (typeof text === "string") {
      return text as T;
    }

    throw new BaseApiError("Unexpected response type", res.status);
  }

  public async fetchStream(
    endpoint: string,
    options?: RequestInit,
    defaultErrorMessage: string = "API request failed",
    queryParams?: Record<string, string | number | boolean>
  ): Promise<Response> {
    const { url, fetchOptions } = await this.prepareRequest(endpoint, options, queryParams);

    return executeRequest(url, fetchOptions, defaultErrorMessage);
  }
}

const defaultClient = new ApiClient();

export function addInterceptor(interceptor: Interceptor) {
    defaultClient.addInterceptor(interceptor);
}

export function clearInterceptors() {
    defaultClient.clearInterceptors();
}

export function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
  defaultErrorMessage?: string,
  queryParams?: Record<string, string | number | boolean>
): Promise<T> {
  return defaultClient.fetch<T>(endpoint, options, defaultErrorMessage, queryParams);
}

export function apiFetchStream(
  endpoint: string,
  options?: RequestInit,
  defaultErrorMessage?: string,
  queryParams?: Record<string, string | number | boolean>
): Promise<Response> {
  return defaultClient.fetchStream(endpoint, options, defaultErrorMessage, queryParams);
}
