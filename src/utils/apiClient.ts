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
      const err = await res.json();
      errorMessage = err.error || defaultErrorMessage;
    } catch {
      errorMessage = res.statusText || defaultErrorMessage;
    }
    throw new BaseApiError(errorMessage, res.status);
  }
  return res.json() as Promise<T>;
}
