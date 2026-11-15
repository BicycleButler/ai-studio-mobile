import { IPlatformService } from "../services/IPlatformService";
import { RETRYABLE_STATUS_CODES, BaseApiError, isAbortError } from "./apiClientErrors";
import { IDelayStrategy, ExponentialBackoffDelayStrategy } from "./delayStrategy";
import { BrowserPlatformService } from "../services/platformService"


export interface RetryConfig {
  retryableStatusCodes?: Set<number>;
  retries?: number;
  fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  retryStrategy?: IRetryStrategy;
  retryNonIdempotent?: boolean;
}

export interface IRetryStrategy {
  execute(
    url: string,
    options: RequestInit,
    config: Required<Pick<RetryConfig, "retries" | "fetcher">> & {
      retryableStatusCodes?: Set<number>;
      retryNonIdempotent?: boolean;
    }
  ): Promise<Response>;
}

const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function parseRetryAfterMs(res: Response | undefined): number | null {
  if (!res || !res.headers || typeof res.headers.get !== "function") return null;
  const header = res.headers.get("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, 30_000);
  }
  const dateMs = Date.parse(header);
  if (Number.isFinite(dateMs)) {
    const delta = dateMs - Date.now();
    return delta > 0 ? Math.min(delta, 30_000) : 0;
  }
  return null;
}

export class ExponentialBackoffRetryStrategy implements IRetryStrategy {
  private delayStrategy: IDelayStrategy;
  private platformService: IPlatformService;

  constructor(delayStrategy?: IDelayStrategy, platformService: IPlatformService = new BrowserPlatformService()) {
    // By default, start with base delay, max limit is not strictly needed for small retry counts
    // but the strategy takes base, max, multiplier.
    this.delayStrategy = delayStrategy || new ExponentialBackoffDelayStrategy(1000, 10000, 2, 500);
    this.platformService = platformService;
  }

  async execute(
    url: string,
    options: RequestInit,
    config: Required<Pick<RetryConfig, "retries" | "fetcher">> & {
      retryableStatusCodes?: Set<number>;
      retryNonIdempotent?: boolean;
    }
  ): Promise<Response> {
    const method = (options.method || "GET").toUpperCase();
    const isIdempotent = IDEMPOTENT_METHODS.has(method);
    const maxAttempts = !isIdempotent && config.retryNonIdempotent !== true ? 1 : Math.max(1, config.retries);
    const { fetcher } = config;
    const retryableCodes = config.retryableStatusCodes || RETRYABLE_STATUS_CODES;

    let attempt = 0;
    let lastError: unknown;
    let lastResponse: Response | undefined;

    while (attempt < maxAttempts) {
      if (options.signal?.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError");
      }
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
      if (attempt >= maxAttempts) {
        if (lastResponse) return lastResponse;
        if (lastError) {
          const msg = lastError instanceof Error ? lastError.message : "Network error during fetch";
          throw BaseApiError.fromResponse(msg, 0, undefined, url, lastError);
        }
        break;
      }

      const retryAfterMs = parseRetryAfterMs(lastResponse);
      const delay =
        retryAfterMs !== null ? retryAfterMs : this.delayStrategy.getNextDelayMs(attempt + 1, lastError);

      await new Promise<void>((resolve, reject) => {
        if (options.signal?.aborted) {
          reject(new DOMException("The operation was aborted.", "AbortError"));
          return;
        }
        let timer: unknown;
        const onAbort = () => {
          if (timer !== undefined) {
            this.platformService.clearTimeout(timer);
          }
          reject(new DOMException("The operation was aborted.", "AbortError"));
        };
        timer = this.platformService.setTimeout(() => {
          options.signal?.removeEventListener("abort", onAbort);
          resolve();
        }, delay);
        options.signal?.addEventListener("abort", onAbort, { once: true });
      });
    }

    if (lastResponse) return lastResponse;
    if (lastError) {
       const msg = lastError instanceof Error ? lastError.message : "Max retries exceeded with network error";
       throw BaseApiError.fromResponse(msg, 0, undefined, url, lastError);
    }
    throw BaseApiError.fromResponse("Max retries exceeded", 0, undefined, url);
  }
}
