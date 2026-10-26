import { describe, expect, test } from 'vitest';
import { BatchSelectionManager } from './batchSelectionManager';

describe('BatchSelectionManager', () => {
  test('initial state', () => {
    const manager = new BatchSelectionManager();
    expect(manager.selectedIds.size).toBe(0);
    expect(manager.lastSelectedId).toBeNull();
    expect(manager.getSelectionState([])).toBe('none');
  });

  test('toggle selection', () => {
    const itemIds = ['1', '2'];
    const manager = new BatchSelectionManager();

    manager.toggleSelection('1', false, 0, itemIds);
    expect(manager.selectedIds.has('1')).toBe(true);
    expect(manager.lastSelectedId).toBe('1');
    expect(manager.getSelectionState(itemIds)).toBe('some');

    manager.toggleSelection('1', false, 0, itemIds);
    expect(manager.selectedIds.has('1')).toBe(false);
    expect(manager.getSelectionState(itemIds)).toBe('none');
  });

  test('shift-click selection', () => {
    const itemIds = ['1', '2', '3', '4'];
    const manager = new BatchSelectionManager();

    manager.toggleSelection('1', false, 0, itemIds);
    manager.toggleSelection('3', true, 2, itemIds);

    expect(manager.selectedIds.has('1')).toBe(true);
    expect(manager.selectedIds.has('2')).toBe(true);
    expect(manager.selectedIds.has('3')).toBe(true);
    expect(manager.selectedIds.has('4')).toBe(false);
  });

  test('select all', () => {
    const itemIds = ['1', '2'];
    const manager = new BatchSelectionManager();

    manager.toggleSelectAll(itemIds);
    expect(manager.selectedIds.size).toBe(2);
    expect(manager.getSelectionState(itemIds)).toBe('all');

    manager.toggleSelectAll(itemIds);
    expect(manager.selectedIds.size).toBe(0);
  });
});
