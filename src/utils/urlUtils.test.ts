import { describe, it, expect } from 'vitest';
import { DefaultUrlBuilder, buildUrlWithParams } from './urlUtils';

describe('buildUrlWithParams', () => {
  it('should return endpoint if no query params provided', () => {
    expect(buildUrlWithParams('/api/test')).toBe('/api/test');
    expect(buildUrlWithParams('/api/test', {})).toBe('/api/test');
  });

  it('should append single query parameters correctly', () => {
    const url = buildUrlWithParams('/api/test', {
      search: 'query',
      limit: 10,
      active: true
    });
    expect(url).toBe('/api/test?search=query&limit=10&active=true');
  });

  it('should handle array query parameters by appending them multiple times', () => {
    const url = buildUrlWithParams('/api/test', {
      tags: ['a', 'b', 'c']
    });
    expect(url).toBe('/api/test?tags=a&tags=b&tags=c');
  });

  it('should ignore null or undefined values', () => {
    const url = buildUrlWithParams('/api/test', {
      search: 'query',
      empty: null as unknown as string,
      missing: undefined as unknown as string,
      limit: 5
    });
    expect(url).toBe('/api/test?search=query&limit=5');
  });

  it('should append to an endpoint that already has query parameters', () => {
    const url = buildUrlWithParams('/api/test?version=1', {
      search: 'query'
    });
    expect(url).toBe('/api/test?version=1&search=query');
  });

  it('should handle trailing question marks gracefully', () => {
    const url = buildUrlWithParams('/api/test?', {
      search: 'query'
    });
    expect(url).toBe('/api/test?search=query');
  });

  it('should handle trailing ampersands gracefully', () => {
    const url = buildUrlWithParams('/api/test&', {
      search: 'query'
    });
    expect(url).toBe('/api/test?search=query');
  });
});

describe('DefaultUrlBuilder', () => {
  const urlBuilder = new DefaultUrlBuilder();

  it('should return endpoint if no query params provided', () => {
    expect(urlBuilder.build('/api/test')).toBe('/api/test');
    expect(urlBuilder.build('/api/test', {})).toBe('/api/test');
  });

  it('should append single query parameters correctly', () => {
    const url = urlBuilder.build('/api/test', {
      search: 'query',
      limit: 10,
      active: true
    });
    expect(url).toBe('/api/test?search=query&limit=10&active=true');
  });

  it('should handle array query parameters by appending them multiple times', () => {
    const url = urlBuilder.build('/api/test', {
      tags: ['a', 'b', 'c']
    });
    expect(url).toBe('/api/test?tags=a&tags=b&tags=c');
  });

  it('should ignore null or undefined values', () => {
    const url = urlBuilder.build('/api/test', {
      search: 'query',
      empty: null as unknown as string,
      missing: undefined as unknown as string,
      limit: 5
    });
    expect(url).toBe('/api/test?search=query&limit=5');
  });

  it('should append to an endpoint that already has query parameters', () => {
    const url = urlBuilder.build('/api/test?version=1', {
      search: 'query'
    });
    expect(url).toBe('/api/test?version=1&search=query');
  });

  it('should handle trailing question marks gracefully', () => {
    const url = urlBuilder.build('/api/test?', {
      search: 'query'
    });
    expect(url).toBe('/api/test?search=query');
  });

  it('should handle trailing ampersands gracefully', () => {
    const url = urlBuilder.build('/api/test&', {
      search: 'query'
    });
    expect(url).toBe('/api/test?search=query');
  });
});
