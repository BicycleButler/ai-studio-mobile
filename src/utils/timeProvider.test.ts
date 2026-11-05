import { describe, it, expect } from 'vitest';
import { DefaultTimeProvider } from './timeProvider';

describe('DefaultTimeProvider', () => {
  it('should return a valid timestamp', () => {
    const provider = new DefaultTimeProvider();
    const timestamp = provider.now();
    expect(typeof timestamp).toBe('number');
    expect(timestamp).toBeGreaterThan(0);
  });

  it('should return a valid Date object', () => {
    const provider = new DefaultTimeProvider();
    const date = provider.date();
    expect(date).toBeInstanceOf(Date);
  });
});

describe('formatRelative', () => {
  it('should format correctly for seconds', () => {
    const provider = new DefaultTimeProvider();
    const now = provider.now();
    expect(provider.formatRelative(now - 10000)).toBe('Just now');
  });

  it('should format correctly for minutes', () => {
    const provider = new DefaultTimeProvider();
    const now = provider.now();
    expect(provider.formatRelative(now - 60000)).toBe('1m ago');
    expect(provider.formatRelative(now - 120000)).toBe('2m ago');
  });

  it('should format correctly for hours', () => {
    const provider = new DefaultTimeProvider();
    const now = provider.now();
    expect(provider.formatRelative(now - 3600000)).toBe('1h ago');
    expect(provider.formatRelative(now - 7200000)).toBe('2h ago');
  });

  it('should format correctly for days', () => {
    const provider = new DefaultTimeProvider();
    const now = provider.now();
    expect(provider.formatRelative(now - 86400000)).toBe('Yesterday');
    expect(provider.formatRelative(now - 172800000)).toBe('2d ago');
  });

  it('should format correctly for older dates', () => {
    const provider = new DefaultTimeProvider();
    const now = provider.now();
    const oldDate = provider.date(now - 86400000 * 10);
    const expectedString = oldDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    expect(provider.formatRelative(oldDate.getTime())).toBe(expectedString);
  });
});
