export type Interceptor = (url: string, options: RequestInit) => Promise<[string, RequestInit]>;

export interface IInterceptorManager {
  addInterceptor(interceptor: Interceptor): void;
  clearInterceptors(): void;
  applyInterceptors(url: string, options: RequestInit): Promise<{ url: string; fetchOptions: RequestInit }>;
}

export class InterceptorManager implements IInterceptorManager {
  private interceptors: Interceptor[] = [];

  public addInterceptor(interceptor: Interceptor): void {
    this.interceptors.push(interceptor);
  }

  public clearInterceptors(): void {
    this.interceptors = [];
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
}
