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
  it('should apply response interceptors in order', async () => {
    const manager = new InterceptorManager();

    manager.addResponseInterceptor(async (res, _url, _options) => {
      // Mock modification
      return new Response(JSON.stringify({ interceptor1: true }), {
        status: res.status,
        statusText: res.statusText,
        headers: (() => { const h = new Headers(res.headers); h.set('X-Res-First', 'true'); return h; })()
      });
    });

    manager.addResponseInterceptor(async (res, _url, _options) => {
      return new Response(await res.text(), {
        status: res.status,
        statusText: res.statusText,
        headers: (() => { const h = new Headers(res.headers); h.set('X-Res-Second', 'true'); return h; })()
      });
    });

    const initialResponse = new Response(JSON.stringify({ initial: true }), { status: 200, headers: { 'X-Initial': 'true' } });
    const result = await manager.applyResponseInterceptors(initialResponse, 'test-url', {});

    expect(result.headers.get('X-Res-First')).toBe('true');
    expect(result.headers.get('X-Res-Second')).toBe('true');
    expect(await result.json()).toEqual({ interceptor1: true });
  });
});
