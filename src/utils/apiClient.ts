import { buildUrlWithParams } from "./urlUtils";
import { BaseApiError, isAbortError, parseErrorResponse } from "./apiClientErrors";
import { InterceptorManager, Interceptor, IInterceptorManager } from "./apiClientInterceptors";
import { ExponentialBackoffRetryStrategy, IRetryStrategy, RetryConfig } from "./apiClientRetry";

export interface ApiClientConfig {
  retryConfig?: RetryConfig;
  interceptorManager?: IInterceptorManager;
}

export interface IApiClient {
  addInterceptor(interceptor: Interceptor): void;
  clearInterceptors(): void;
  fetch<T>(
    endpoint: string,
    options?: RequestInit,
    defaultErrorMessage?: string,
    queryParams?: Record<string, string | number | boolean | (string | number | boolean)[]>
  ): Promise<T>;
  fetchStream(
    endpoint: string,
    options?: RequestInit,
    defaultErrorMessage?: string,
    queryParams?: Record<string, string | number | boolean | (string | number | boolean)[]>
  ): Promise<Response>;
}

export class ApiClient implements IApiClient {
  private interceptorManager: IInterceptorManager;
  public retryConfig: Required<Pick<RetryConfig, "retries" | "fetcher">> & { retryStrategy: IRetryStrategy, retryableStatusCodes?: Set<number> };

  constructor(config: ApiClientConfig | RetryConfig = {}) {
    // For backwards compatibility, if config has no 'retryConfig' or 'interceptorManager' properties,
    // we assume it is a RetryConfig object.
    const retryConfig = ('retryConfig' in config) ? (config as ApiClientConfig).retryConfig || {} : (config as RetryConfig);
    this.interceptorManager = ('interceptorManager' in config && (config as ApiClientConfig).interceptorManager)
      ? (config as ApiClientConfig).interceptorManager as IInterceptorManager
      : new InterceptorManager();

    this.retryConfig = {
      retries: retryConfig.retries ?? 3,
      fetcher: retryConfig.fetcher ?? fetch,
      retryStrategy: retryConfig.retryStrategy ?? new ExponentialBackoffRetryStrategy(),
      retryableStatusCodes: retryConfig.retryableStatusCodes,
    };
  }

  public addInterceptor(interceptor: Interceptor): void {
    this.interceptorManager.addInterceptor(interceptor);
  }

  public clearInterceptors(): void {
    this.interceptorManager.clearInterceptors();
  }

  private async prepareRequest(
    endpoint: string,
    options?: RequestInit,
    queryParams?: Record<string, string | number | boolean | (string | number | boolean)[]>
  ): Promise<{ url: string; fetchOptions: RequestInit }> {
    let url = buildUrlWithParams(endpoint, queryParams);
    let fetchOptions = options || {};

    return this.interceptorManager.applyInterceptors(url, fetchOptions);
  }

  private async fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
    return this.retryConfig.retryStrategy.execute(url, options, {
      retries: this.retryConfig.retries,
      fetcher: this.retryConfig.fetcher,
      retryableStatusCodes: this.retryConfig.retryableStatusCodes,
    });
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
      // Ensure we don't leak raw DOM exceptions; wrap them cleanly
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : defaultErrorMessage;
      throw BaseApiError.fromResponse(msg, 0, undefined, endpoint, err);
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
    queryParams?: Record<string, string | number | boolean | (string | number | boolean)[]>
  ): Promise<T> {
    const { url, fetchOptions } = await this.prepareRequest(endpoint, options, queryParams);

    const res = await this.executeRequest(url, fetchOptions, defaultErrorMessage);

    if (res.status === 204) {
      return {} as T;
    }

    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      try {
        return await res.json() as T;
      } catch (err: unknown) {
        const headersRecord: Record<string, string> = {};
        res.headers.forEach((value, key) => { headersRecord[key] = value; });
        throw BaseApiError.fromResponse("Invalid JSON response from server", res.status, headersRecord, endpoint, err);
      }
    }

    const text = await res.text();
    return text as unknown as T;
  }

  public async fetchStream(
    endpoint: string,
    options?: RequestInit,
    defaultErrorMessage: string = "API request failed",
    queryParams?: Record<string, string | number | boolean | (string | number | boolean)[]>
  ): Promise<Response> {
    const { url, fetchOptions } = await this.prepareRequest(endpoint, options, queryParams);

    return this.executeRequest(url, fetchOptions, defaultErrorMessage);
  }
}

// Expose the interface but keep the instance variable typed as ApiClient internally to avoid type issues with retryConfig.
export const defaultClient = new ApiClient();

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
  queryParams?: Record<string, string | number | boolean | (string | number | boolean)[]>
): Promise<T> {
  return defaultClient.fetch<T>(endpoint, options, defaultErrorMessage, queryParams);
}

export function apiFetchStream(
  endpoint: string,
  options?: RequestInit,
  defaultErrorMessage?: string,
  queryParams?: Record<string, string | number | boolean | (string | number | boolean)[]>
): Promise<Response> {
  return defaultClient.fetchStream(endpoint, options, defaultErrorMessage, queryParams);
}

export * from "./apiClientErrors";
export * from "./apiClientInterceptors";
export * from "./apiClientRetry";
