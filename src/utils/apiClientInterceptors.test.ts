import { describe, it, expect } from 'vitest';
import { InterceptorManager } from './apiClientInterceptors';

describe('InterceptorManager', () => {
  it('should apply interceptors in order', async () => {
    const manager = new InterceptorManager();

    manager.addInterceptor(async (url, options) => {
      return [`${url}?first=true`, { ...options, headers: { ...options.headers, 'X-First': 'true' } }];
    });

    manager.addInterceptor(async (url, options) => {
      return [`${url}&second=true`, { ...options, headers: { ...options.headers, 'X-Second': 'true' } }];
    });

    const result = await manager.applyInterceptors('test-url', { headers: { 'X-Initial': 'true' } });

    expect(result.url).toBe('test-url?first=true&second=true');
    expect(result.fetchOptions.headers).toEqual({
      'X-Initial': 'true',
      'X-First': 'true',
      'X-Second': 'true',
    });
  });

  it('should clear interceptors', async () => {
    const manager = new InterceptorManager();
    manager.addInterceptor(async (url, options) => [`${url}?mod`, options]);
    manager.clearInterceptors();

    const result = await manager.applyInterceptors('test-url', {});
    expect(result.url).toBe('test-url');
  });
});
