export class BaseApiError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "BaseApiError";
    this.statusCode = statusCode;
  }
}

async function parseErrorResponse(res: Response, defaultErrorMessage: string): Promise<string> {
  let errorMessage = defaultErrorMessage;
  try {
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
  return errorMessage;
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
    if (err instanceof Error && err.name === "AbortError") {
      throw err;
    }
    throw new BaseApiError(err instanceof Error ? err.message : defaultErrorMessage, 0);
  }

  if (!res.ok) {
    const errorMessage = await parseErrorResponse(res, defaultErrorMessage);
    throw new BaseApiError(errorMessage, res.status);
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
    if (err instanceof Error && err.name === "AbortError") {
      throw err;
    }
    throw new BaseApiError(err instanceof Error ? err.message : defaultErrorMessage, 0);
  }

  if (!res.ok) {
    const errorMessage = await parseErrorResponse(res, defaultErrorMessage);
    throw new BaseApiError(errorMessage, res.status);
  }

  return res;
}
