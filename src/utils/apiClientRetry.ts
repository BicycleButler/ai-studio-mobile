import { RETRYABLE_STATUS_CODES, BaseApiError, isAbortError } from "./apiClientErrors";
import { IDelayStrategy, ExponentialBackoffDelayStrategy } from "./delayStrategy";

export interface RetryConfig {
  retryableStatusCodes?: Set<number>;
  retries?: number;
  fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  retryStrategy?: IRetryStrategy;
}

export interface IRetryStrategy {
  execute(
    url: string,
    options: RequestInit,
    config: Required<Pick<RetryConfig, "retries" | "fetcher">> & { retryableStatusCodes?: Set<number> }
  ): Promise<Response>;
}

export class ExponentialBackoffRetryStrategy implements IRetryStrategy {
  private delayStrategy: IDelayStrategy;

  constructor(delayStrategy?: IDelayStrategy) {
    // By default, start with baseDelayMs, max limit isn't strictly needed for small retry counts
    // but the strategy takes base, max, multiplier.
    this.delayStrategy = delayStrategy || new ExponentialBackoffDelayStrategy(1000, 10000, 2, 500);
  }

  async execute(
    url: string,
    options: RequestInit,
    config: Required<Pick<RetryConfig, "retries" | "fetcher">> & { retryableStatusCodes?: Set<number> }
  ): Promise<Response> {
    const { retries, fetcher } = config;
    const retryableCodes = config.retryableStatusCodes || RETRYABLE_STATUS_CODES;

    let effectiveStrategy = this.delayStrategy;

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
        lastError = new Error(`Request failed with status ${res.status}`); // For the delay calculation
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

      const delay = effectiveStrategy.getNextDelayMs(attempt + 1, lastError);
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
