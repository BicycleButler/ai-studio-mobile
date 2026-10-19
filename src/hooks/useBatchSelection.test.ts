import { renderHook, act } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { useBatchSelection } from './useBatchSelection';

test('useBatchSelection initial state', () => {
  const items = [{ id: '1' }, { id: '2' }];
  const { result } = renderHook(() =>
    useBatchSelection({ items, getItemId: (item) => item.id })
  );

  expect(result.current.selectedIds.size).toBe(0);
  expect(result.current.lastSelectedId).toBeNull();
});

test('useBatchSelection toggle selection', () => {
  const items = [{ id: '1' }, { id: '2' }];
  const { result } = renderHook(() =>
    useBatchSelection({ items, getItemId: (item) => item.id })
  );

  act(() => {
    result.current.toggleSelection('1', { stopPropagation: vi.fn() } as any, 0);
  });

  expect(result.current.selectedIds.has('1')).toBe(true);
  expect(result.current.lastSelectedId).toBe('1');

  act(() => {
    result.current.toggleSelection('1', { stopPropagation: vi.fn() } as any, 0);
  });

  expect(result.current.selectedIds.has('1')).toBe(false);
});

test('useBatchSelection shift-click selection', () => {
  const items = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }];
  const { result } = renderHook(() =>
    useBatchSelection({ items, getItemId: (item) => item.id })
  );

  act(() => {
    result.current.toggleSelection('1', { stopPropagation: vi.fn() } as any, 0);
  });

  act(() => {
    result.current.toggleSelection('3', { shiftKey: true, stopPropagation: vi.fn() } as any, 2);
  });

  expect(result.current.selectedIds.has('1')).toBe(true);
  expect(result.current.selectedIds.has('2')).toBe(true);
  expect(result.current.selectedIds.has('3')).toBe(true);
  expect(result.current.selectedIds.has('4')).toBe(false);
});

test('useBatchSelection select all', () => {
  const items = [{ id: '1' }, { id: '2' }];
  const { result } = renderHook(() =>
    useBatchSelection({ items, getItemId: (item) => item.id })
  );

  act(() => {
    result.current.toggleSelectAll();
  });

  expect(result.current.selectedIds.size).toBe(2);

  act(() => {
    result.current.toggleSelectAll();
  });

  expect(result.current.selectedIds.size).toBe(0);
});
