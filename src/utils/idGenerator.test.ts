import { describe, it, expect } from 'vitest';
import { DefaultIdGenerator } from './idGenerator';

describe('DefaultIdGenerator', () => {
  it('should generate an id with the given prefix', () => {
    const generator = new DefaultIdGenerator();
    const id = generator.generate('test_prefix');
    expect(id.startsWith('test_prefix_')).toBe(true);
  });

  it('should include the timestamp and random string', () => {
    const generator = new DefaultIdGenerator();
    const id = generator.generate('test');
    const parts = id.split('_');
    expect(parts.length).toBe(3); // prefix, timestamp, randomSuffix

    const timestampStr = parts[1];
    expect(parseInt(timestampStr)).toBeGreaterThan(0);
  });

  it('should include explicit suffix if provided', () => {
    const generator = new DefaultIdGenerator();
    const id = generator.generate('test', 'explicit');
    const parts = id.split('_');
    // test_timestamp_explicit_random
    expect(parts.length).toBe(4);
    expect(parts[2]).toBe('explicit');
  });

  it('should generate unique ids on subsequent calls', () => {
    const generator = new DefaultIdGenerator();
    const id1 = generator.generate('test');
    const id2 = generator.generate('test');
    expect(id1).not.toBe(id2);
  });
});
