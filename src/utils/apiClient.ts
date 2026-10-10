export class BaseApiError extends Error {
  public statusCode: number;
  public headers?: Record<string, string>;

  constructor(message: string, statusCode: number, headers?: Record<string, string>) {
    super(message);
    this.name = "BaseApiError";
    this.statusCode = statusCode;
    this.headers = headers;
  }
}

export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

async function parseErrorResponse(res: Response, defaultErrorMessage: string): Promise<{ errorMessage: string; headers: Record<string, string> }> {
  let errorMessage = defaultErrorMessage;
  const headers: Record<string, string> = {};

  try {
    res.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const err = await res.json();
      errorMessage = err.error || err.message || defaultErrorMessage;
    } else {
      errorMessage = res.statusText || defaultErrorMessage;
    }
  } catch {
    errorMessage = res.statusText || defaultErrorMessage;
  }
  return { errorMessage, headers };
}

export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
  defaultErrorMessage: string = "API request failed"
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(endpoint, options);
  } catch (err: unknown) {
    if (isAbortError(err)) {
      throw err;
    }
    throw new BaseApiError(err instanceof Error ? err.message : defaultErrorMessage, 0);
  }

  if (!res.ok) {
    const { errorMessage, headers } = await parseErrorResponse(res, defaultErrorMessage);
    throw new BaseApiError(errorMessage, res.status, headers);
  }

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
  defaultErrorMessage: string = "API request failed"
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(endpoint, options);
  } catch (err: unknown) {
    if (isAbortError(err)) {
      throw err;
    }
    throw new BaseApiError(err instanceof Error ? err.message : defaultErrorMessage, 0);
  }

  if (!res.ok) {
    const { errorMessage, headers } = await parseErrorResponse(res, defaultErrorMessage);
    throw new BaseApiError(errorMessage, res.status, headers);
  }

  return res;
}
