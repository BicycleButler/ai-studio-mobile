import { describe, it, expect, vi } from 'vitest';
import { StorageRegistry } from './StorageRegistry';

describe('StorageRegistry', () => {
  it('should initialize and return correctly', () => {
    let mockFactory = vi.fn().mockReturnValue({ data: 'mock' });
    const registry = new StorageRegistry(mockFactory);
    expect(registry.get('test_key')).toEqual({ data: 'mock' });
    expect(mockFactory).toHaveBeenCalledWith('test_key');
  });

  it('should return from cache', () => {
    let mockFactory = vi.fn().mockReturnValue({ data: 'mock' });
    const registry = new StorageRegistry(mockFactory);
    registry.get('test_key');
    registry.get('test_key');
    expect(mockFactory).toHaveBeenCalledTimes(1);
  });

  it('should delete keys', () => {
    let mockFactory = vi.fn().mockReturnValue({ data: 'mock', dispose: vi.fn() });
    const registry = new StorageRegistry(mockFactory);
    registry.get('test_key');
    expect(registry.keys).toContain('test_key');
    registry.delete('test_key');
    expect(registry.keys).not.toContain('test_key');
  });

  it('should clear keys', () => {
    let mockFactory = vi.fn().mockReturnValue({ data: 'mock', dispose: vi.fn() });
    const registry = new StorageRegistry(mockFactory);
    registry.get('test_key1');
    registry.get('test_key2');
    expect(registry.keys.length).toBe(2);
    registry.clear();
    expect(registry.keys.length).toBe(0);
  });

  it('should get values', () => {
    let mockFactory = vi.fn().mockImplementation((k) => ({ data: k }));
    const registry = new StorageRegistry(mockFactory);
    registry.get('test_key1');
    registry.get('test_key2');
    expect(registry.values).toEqual([{ data: 'test_key1' }, { data: 'test_key2' }]);
  });
});
