import { describe, it, expect } from 'vitest';
import { DefaultRandomProvider } from './randomProvider';

describe('DefaultRandomProvider', () => {
  it('should return a number between 0 and 1', () => {
    const provider = new DefaultRandomProvider();
    const value = provider.random();
    expect(typeof value).toBe('number');
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });
});
