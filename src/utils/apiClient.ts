import { IUrlBuilder } from "./urlUtils";
import { BaseApiError, isAbortError, parseErrorResponse } from "./apiClientErrors";
import { Interceptor, IInterceptorManager, ResponseInterceptor } from "./apiClientInterceptors";
import { ExponentialBackoffRetryStrategy, IRetryStrategy, RetryConfig } from "./apiClientRetry";
import { IResponseParser } from "./apiResponseParser";

export interface ApiClientConfig {
  interceptorManager: IInterceptorManager;
  responseParser: IResponseParser;
  urlBuilder: IUrlBuilder;
  retryConfig?: RetryConfig;
}

export interface IApiClient {
  addInterceptor(interceptor: Interceptor): void;
  clearInterceptors(): void;
  addResponseInterceptor(interceptor: ResponseInterceptor): void;
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
  private responseParser: IResponseParser;
  private urlBuilder: IUrlBuilder;
  public retryConfig: Required<Pick<RetryConfig, "retries" | "fetcher">> & { retryStrategy: IRetryStrategy, retryableStatusCodes?: Set<number> };
  constructor(config: ApiClientConfig) {
    const retryConfig = config.retryConfig || {};
    this.interceptorManager = config.interceptorManager;
    this.responseParser = config.responseParser;
    this.urlBuilder = config.urlBuilder;
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
  public addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.interceptorManager.addResponseInterceptor(interceptor);
  }
  private async prepareRequest(
    endpoint: string,
    options?: RequestInit,
    queryParams?: Record<string, string | number | boolean | (string | number | boolean)[]>
  ): Promise<{ url: string; fetchOptions: RequestInit }> {
    let url = this.urlBuilder.build(endpoint, queryParams);
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
      res = await this.interceptorManager.applyResponseInterceptors(res, endpoint, options || {});
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
    return this.responseParser.parse<T>(res, endpoint);
  }
  public async fetchStream(
    endpoint: string,
    options?: RequestInit,
    defaultErrorMessage: string = "API request failed",
    queryParams?: Record<string, string | number | boolean | (string | number | boolean)[]>
  ): Promise<Response> {
    const { url, fetchOptions } = await this.prepareRequest(endpoint, options, queryParams);
    const res = await this.executeRequest(url, fetchOptions, defaultErrorMessage);
    return this.responseParser.parseStream(res, endpoint);
  }
}

export * from "./apiClientErrors";
export * from "./apiClientInterceptors";
export * from "./apiClientRetry";
