import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePendingSyncIds } from './usePendingSyncIds';
import { useOfflineQueue } from './useOfflineQueue';

vi.mock('./useOfflineQueue', () => ({
  useOfflineQueue: vi.fn(),
}));

describe('usePendingSyncIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty set when queue is empty', () => {
    (useOfflineQueue as any).mockReturnValue([]);
    const { result } = renderHook(() => usePendingSyncIds('test'));
    expect(result.current.size).toBe(0);
  });

  it('should parse array payload directly', () => {
    (useOfflineQueue as any).mockReturnValue([
      { type: 'test', payload: [{ id: '1' }, { id: '2' }] },
      { type: 'other', payload: [{ id: '3' }] }
    ]);
    const { result } = renderHook(() => usePendingSyncIds('test'));
    expect(result.current.has('1')).toBe(true);
    expect(result.current.has('2')).toBe(true);
    expect(result.current.has('3')).toBe(false);
    expect(result.current.size).toBe(2);
  });

  it('should parse nested object payload with arrayKey', () => {
    (useOfflineQueue as any).mockReturnValue([
      { type: 'test', payload: { data: [{ id: '1' }, { id: '2' }] } },
      { type: 'test', payload: { other: [{ id: '3' }] } }
    ]);
    const { result } = renderHook(() => usePendingSyncIds('test', 'data'));
    expect(result.current.has('1')).toBe(true);
    expect(result.current.has('2')).toBe(true);
    expect(result.current.has('3')).toBe(false);
    expect(result.current.size).toBe(2);
  });

  it('should handle malformed payloads gracefully', () => {
    (useOfflineQueue as any).mockReturnValue([
      { type: 'test', payload: null },
      { type: 'test', payload: undefined },
      { type: 'test', payload: 'string' },
      { type: 'test', payload: { data: 'not_an_array' } },
      { type: 'test', payload: { data: [{ no_id: 'here' }] } }
    ]);
    const { result } = renderHook(() => usePendingSyncIds('test', 'data'));
    expect(result.current.has(undefined as any)).toBe(true); // Based on how it's written it maps missing id to undefined
  });
});
