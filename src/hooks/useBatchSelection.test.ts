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
  expect(result.current.getSelectionState()).toBe('none');
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
  expect(result.current.getSelectionState()).toBe('some');

  act(() => {
    result.current.toggleSelection('1', { stopPropagation: vi.fn() } as any, 0);
  });

  expect(result.current.selectedIds.has('1')).toBe(false);
  expect(result.current.getSelectionState()).toBe('none');
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
  expect(result.current.getSelectionState()).toBe('all');

  act(() => {
    result.current.toggleSelectAll();
  });

  expect(result.current.selectedIds.size).toBe(0);
});

test('useBatchSelection select all with filtered list', () => {
  const items = [{ id: '1' }, { id: '2' }, { id: '3' }];
  const filteredItems = [{ id: '1' }, { id: '2' }];

  const { result } = renderHook(() =>
    useBatchSelection({ items, getItemId: (item) => item.id })
  );

  act(() => {
    result.current.toggleSelectAll(filteredItems);
  });

  expect(result.current.selectedIds.size).toBe(2);
  expect(result.current.selectedIds.has('1')).toBe(true);
  expect(result.current.selectedIds.has('2')).toBe(true);
  expect(result.current.selectedIds.has('3')).toBe(false);
  expect(result.current.getSelectionState(filteredItems)).toBe('all');
  expect(result.current.getSelectionState(items)).toBe('some');

  act(() => {
    result.current.toggleSelectAll(filteredItems);
  });

  expect(result.current.selectedIds.size).toBe(0);
  expect(result.current.getSelectionState(filteredItems)).toBe('none');
});
