export class BaseApiError extends Error {
  public statusCode: number;
  public headers?: Record<string, string>;
  public endpoint?: string;

  constructor(message: string, statusCode: number, headers?: Record<string, string>, endpoint?: string) {
    super(message);
    this.name = "BaseApiError";
    this.statusCode = statusCode;
    this.headers = headers;
    this.endpoint = endpoint;
  }

  static fromResponse(message: string, statusCode: number, headers?: Record<string, string>, endpoint?: string): BaseApiError {
    return new BaseApiError(message, statusCode, headers, endpoint);
  }

  public isRetryable(): boolean {
    return this.statusCode === 429 || this.statusCode === 502 || this.statusCode === 503 || this.statusCode === 504 || this.statusCode === 0;
  }
}

export function isAbortError(err: unknown): boolean {
  if (err instanceof Error && err.name === "AbortError") return true;
  if (typeof DOMException !== "undefined" && err instanceof DOMException && err.name === "AbortError") return true;
  return false;
}

export async function parseErrorResponse(res: Response, defaultErrorMessage: string): Promise<{ errorMessage: string; headers: Record<string, string> }> {
  const headers: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let errorMessage = defaultErrorMessage;

  try {
    const contentType = res.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const err = await res.json();
      errorMessage = err.error || err.message || res.statusText || defaultErrorMessage;
    } else {
      const text = await res.text();
      errorMessage = text || res.statusText || defaultErrorMessage;
    }
  } catch {
    errorMessage = res.statusText || defaultErrorMessage;
  }
  return { errorMessage, headers };
}

async function executeRequest(
  endpoint: string,
  options?: RequestInit,
  defaultErrorMessage: string = "API request failed"
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(endpoint, options);
  } catch (err: unknown) {
    if (isAbortError(err)) {
      throw err;
    }
    throw BaseApiError.fromResponse(err instanceof Error ? err.message : defaultErrorMessage, 0, undefined, endpoint);
  }

  if (!res.ok) {
    const { errorMessage, headers } = await parseErrorResponse(res, defaultErrorMessage);
    throw BaseApiError.fromResponse(errorMessage, res.status, headers, endpoint);
  }

  return res;
}

export type Interceptor = (url: string, options: RequestInit) => Promise<[string, RequestInit]>;

let interceptors: Interceptor[] = [];

export function addInterceptor(interceptor: Interceptor) {
    interceptors.push(interceptor);
}

export function clearInterceptors() {
    interceptors = [];
}

export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
  defaultErrorMessage: string = "API request failed",
  queryParams?: Record<string, string | number | boolean>
): Promise<T> {
  let url = endpoint;

  if (queryParams && Object.keys(queryParams).length > 0) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(queryParams)) {
      searchParams.append(key, String(value));
    }
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}${searchParams.toString()}`;
  }

  let fetchOptions = options || {};

  for (const interceptor of interceptors) {
      const [newUrl, newOptions] = await interceptor(url, fetchOptions);
      url = newUrl;
      fetchOptions = newOptions;
  }

  const res = await executeRequest(url, fetchOptions, defaultErrorMessage);

  if (res.status === 204) {
    return {} as T;
  }

  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return res.json() as Promise<T>;
  }

  // Handle plain text responses safely
  const text = await res.text();
  if (typeof text === "string") {
    // If T is expected to be a string (e.g. text/plain requests)
    return text as T;
  }

  throw new BaseApiError("Unexpected response type", res.status);
}

export async function apiFetchStream(
  endpoint: string,
  options?: RequestInit,
  defaultErrorMessage: string = "API request failed",
  queryParams?: Record<string, string | number | boolean>
): Promise<Response> {
  let url = endpoint;

  if (queryParams && Object.keys(queryParams).length > 0) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(queryParams)) {
      searchParams.append(key, String(value));
    }
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}${searchParams.toString()}`;
  }

  return executeRequest(url, options, defaultErrorMessage);
}
