import { describe, it, expect, vi } from 'vitest';
import { generateUniqueId } from './idGenerator';

describe('generateUniqueId', () => {
  it('should generate an id with the given prefix', () => {
    const id = generateUniqueId('test_prefix');
    expect(id.startsWith('test_prefix_')).toBe(true);
  });

  it('should include the timestamp and random string', () => {
    const id = generateUniqueId('test');
    const parts = id.split('_');
    expect(parts.length).toBe(3); // prefix, timestamp, randomSuffix

    const timestampStr = parts[1];
    expect(parseInt(timestampStr)).toBeGreaterThan(0);
  });

  it('should include explicit suffix if provided', () => {
    const id = generateUniqueId('test', 'explicit');
    const parts = id.split('_');
    // test_timestamp_explicit_random
    expect(parts.length).toBe(4);
    expect(parts[2]).toBe('explicit');
  });

  it('should generate unique ids on subsequent calls', () => {
    const id1 = generateUniqueId('test');
    const id2 = generateUniqueId('test');
    expect(id1).not.toBe(id2);
  });
});
