import { describe, it, expect } from 'vitest';
import { JsonSerializer } from './JsonSerializer';

describe('JsonSerializer', () => {
  it('should serialize correctly', () => {
    const serializer = new JsonSerializer();
    const result = serializer.serialize({ test: "data" });
    expect(result).toBe('{"test":"data"}');
  });

  it('should deserialize correctly', () => {
    const serializer = new JsonSerializer();
    const result = serializer.deserialize<{test: string}>('{"test":"data"}');
    expect(result).toEqual({ test: "data" });
  });

  it('should throw on invalid json', () => {
    const serializer = new JsonSerializer();
    expect(() => serializer.deserialize('{invalid json')).toThrow();
  });
});
