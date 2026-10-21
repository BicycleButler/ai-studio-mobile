import { describe, expect, test } from 'vitest';
import { BatchSelectionManager } from './batchSelectionManager';

describe('BatchSelectionManager', () => {
  test('initial state', () => {
    const manager = new BatchSelectionManager<{ id: string }>(item => item.id);
    expect(manager.selectedIds.size).toBe(0);
    expect(manager.lastSelectedId).toBeNull();
    expect(manager.getSelectionState([])).toBe('none');
  });

  test('toggle selection', () => {
    const items = [{ id: '1' }, { id: '2' }];
    const manager = new BatchSelectionManager<{ id: string }>(item => item.id);

    manager.toggleSelection('1', false, 0, items);
    expect(manager.selectedIds.has('1')).toBe(true);
    expect(manager.lastSelectedId).toBe('1');
    expect(manager.getSelectionState(items)).toBe('some');

    manager.toggleSelection('1', false, 0, items);
    expect(manager.selectedIds.has('1')).toBe(false);
    expect(manager.getSelectionState(items)).toBe('none');
  });

  test('shift-click selection', () => {
    const items = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }];
    const manager = new BatchSelectionManager<{ id: string }>(item => item.id);

    manager.toggleSelection('1', false, 0, items);
    manager.toggleSelection('3', true, 2, items);

    expect(manager.selectedIds.has('1')).toBe(true);
    expect(manager.selectedIds.has('2')).toBe(true);
    expect(manager.selectedIds.has('3')).toBe(true);
    expect(manager.selectedIds.has('4')).toBe(false);
  });

  test('select all', () => {
    const items = [{ id: '1' }, { id: '2' }];
    const manager = new BatchSelectionManager<{ id: string }>(item => item.id);

    manager.toggleSelectAll(items);
    expect(manager.selectedIds.size).toBe(2);
    expect(manager.getSelectionState(items)).toBe('all');

    manager.toggleSelectAll(items);
    expect(manager.selectedIds.size).toBe(0);
  });
});
