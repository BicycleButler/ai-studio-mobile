import { RETRYABLE_STATUS_CODES, BaseApiError, isAbortError } from "./apiClientErrors";

export interface RetryConfig {
  retryableStatusCodes?: Set<number>;
  retries?: number;
  baseDelayMs?: number;
  fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  retryStrategy?: IRetryStrategy;
}

export interface IRetryStrategy {
  execute(
    url: string,
    options: RequestInit,
    config: Required<Pick<RetryConfig, "retries" | "baseDelayMs" | "fetcher">> & { retryableStatusCodes?: Set<number> }
  ): Promise<Response>;
}

export class ExponentialBackoffRetryStrategy implements IRetryStrategy {
  async execute(
    url: string,
    options: RequestInit,
    config: Required<Pick<RetryConfig, "retries" | "baseDelayMs" | "fetcher">> & { retryableStatusCodes?: Set<number> }
  ): Promise<Response> {
    const { retries, baseDelayMs, fetcher } = config;
    const retryableCodes = config.retryableStatusCodes || RETRYABLE_STATUS_CODES;
    let attempt = 0;
    let lastError: unknown;
    let lastResponse: Response | undefined;

    while (attempt < retries) {
      try {
        const res = await fetcher(url, options);
        if (res.ok || !retryableCodes.has(res.status)) {
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
        if (lastError) {
          const msg = lastError instanceof Error ? lastError.message : "Network error during fetch";
          throw BaseApiError.fromResponse(msg, 0, undefined, url, lastError);
        }
        break;
      }

      const delay = Math.pow(2, attempt) * baseDelayMs + Math.random() * baseDelayMs;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    if (lastResponse) return lastResponse;
    if (lastError) {
       const msg = lastError instanceof Error ? lastError.message : "Max retries exceeded with network error";
       throw BaseApiError.fromResponse(msg, 0, undefined, url, lastError);
    }
    throw BaseApiError.fromResponse("Max retries exceeded", 0, undefined, url);
  }
}
