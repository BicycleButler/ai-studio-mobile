import { describe, test, expect } from 'vitest';
import { getNestedValue } from './helpers';

describe('helpers', () => {
  test('getNestedValue', () => {
    const obj = { a: { b: { c: 1 } } };
    expect(getNestedValue(obj, ['a', 'b', 'c'], 0)).toBe(1);
    expect(getNestedValue(obj, ['a', 'b', 'd'], 0)).toBe(0);
    expect(getNestedValue(null, ['a'], 0)).toBe(0);
  });
});
