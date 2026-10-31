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
