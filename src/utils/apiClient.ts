export class BaseApiError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "BaseApiError";
    this.statusCode = statusCode;
  }
}

export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
  defaultErrorMessage: string = "API request failed"
): Promise<T> {
  const res = await fetch(endpoint, options);

  if (!res.ok) {
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
    throw new BaseApiError(errorMessage, res.status);
  }

  if (res.status === 204) {
    return {} as T;
  }

  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return res.json() as Promise<T>;
  }

  return res.text() as Promise<unknown> as Promise<T>;
}
