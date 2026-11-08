export type RequestInterceptor = (url: string, options: RequestInit) => Promise<[string, RequestInit]>;
// Maintain backward compatibility
export type Interceptor = RequestInterceptor;
export type ResponseInterceptor = (res: Response, url: string, options: RequestInit) => Promise<Response>;

export interface IInterceptorManager {
  addInterceptor(interceptor: Interceptor): void;
  clearInterceptors(): void;
  applyInterceptors(url: string, options: RequestInit): Promise<{ url: string; fetchOptions: RequestInit }>;
  addResponseInterceptor(interceptor: ResponseInterceptor): void;
  applyResponseInterceptors(res: Response, url: string, options: RequestInit): Promise<Response>;
}

export class InterceptorManager implements IInterceptorManager {
  private interceptors: Interceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];

  public addInterceptor(interceptor: Interceptor): void {
    this.interceptors.push(interceptor);
  }

  public clearInterceptors(): void {
    this.interceptors = [];
    this.responseInterceptors = [];
  }

  public async applyInterceptors(url: string, options: RequestInit): Promise<{ url: string; fetchOptions: RequestInit }> {
    let currentUrl = url;
    let currentOptions = options;

    for (const interceptor of this.interceptors) {
      const [newUrl, newOptions] = await interceptor(currentUrl, currentOptions);
      currentUrl = newUrl;
      currentOptions = newOptions;
    }

    return { url: currentUrl, fetchOptions: currentOptions };
  }

  public addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  public async applyResponseInterceptors(res: Response, url: string, options: RequestInit): Promise<Response> {
    let currentResponse = res;
    for (const interceptor of this.responseInterceptors) {
      currentResponse = await interceptor(currentResponse, url, options);
    }
    return currentResponse;
  }
}
