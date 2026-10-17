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
  public retryConfig: RetryConfig;

  constructor(retryConfig: RetryConfig = {}) {
    this.retryConfig = {
      retries: retryConfig.retries ?? 3,
      baseDelayMs: retryConfig.baseDelayMs ?? 1000,
      fetcher: retryConfig.fetcher ?? fetch,
    };
  }

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

  private async fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
    const retries = this.retryConfig.retries!;
    const baseDelayMs = this.retryConfig.baseDelayMs!;
    const fetcher = this.retryConfig.fetcher!;

    let attempt = 0;
    let lastError: unknown;
    let lastResponse: Response | undefined;

    while (attempt < retries) {
      try {
        const res = await fetcher(url, options);
        if (res.ok || !RETRYABLE_STATUS_CODES.has(res.status)) {
          return res;
        }
        lastResponse = res;
        lastError = undefined;
      } catch (err: unknown) {
        if (isAbortError(err)) throw err;
        lastError = err;
        lastResponse = undefined;
      }

      attempt++;
      if (attempt >= retries) {
        if (lastResponse) return lastResponse;
        if (lastError) throw lastError;
        break;
      }

      const delay = Math.pow(2, attempt) * baseDelayMs + Math.random() * baseDelayMs;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    throw new Error("Max retries exceeded");
  }

  private async executeRequest(
    endpoint: string,
    options?: RequestInit,
    defaultErrorMessage: string = "API request failed"
  ): Promise<Response> {
    let res: Response;
    try {
      res = await this.fetchWithRetry(endpoint, options || {});
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

  public async fetch<T>(
    endpoint: string,
    options?: RequestInit,
    defaultErrorMessage: string = "API request failed",
    queryParams?: Record<string, string | number | boolean>
  ): Promise<T> {
    const { url, fetchOptions } = await this.prepareRequest(endpoint, options, queryParams);

    const res = await this.executeRequest(url, fetchOptions, defaultErrorMessage);

    if (res.status === 204) {
      return {} as T;
    }

    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return res.json() as Promise<T>;
    }

    const text = await res.text();
    return text as unknown as T;
  }

  public async fetchStream(
    endpoint: string,
    options?: RequestInit,
    defaultErrorMessage: string = "API request failed",
    queryParams?: Record<string, string | number | boolean>
  ): Promise<Response> {
    const { url, fetchOptions } = await this.prepareRequest(endpoint, options, queryParams);

    return this.executeRequest(url, fetchOptions, defaultErrorMessage);
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
