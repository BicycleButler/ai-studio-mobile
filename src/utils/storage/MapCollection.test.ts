import { describe, it, expect } from 'vitest';
import { MapCollection } from './MapCollection';

describe('MapCollection', () => {
  it('should initialize correctly', () => {
    const coll = new MapCollection<{ id: string }>(item => item.id);
    expect(coll).toBeDefined();
  });

  it('should upsert item and resolve single updated item correctly', () => {
    const coll = new MapCollection<{ id: string, name: string }>(item => item.id);
    const result = coll.upsert([], { id: '1', name: 'a' });
    expect(result.items).toEqual([{ id: '1', name: 'a' }]);
    expect(result.changed).toBe(true);
    expect(result.item).toEqual({ id: '1', name: 'a' });

    const result2 = coll.upsert(result.items, { id: '1', name: 'b' });
    expect(result2.items).toEqual([{ id: '1', name: 'b' }]);
    expect(result2.changed).toBe(true);
    expect(result2.item).toEqual({ id: '1', name: 'b' });
  });

  it('should update item and resolve single updated item correctly', () => {
    const coll = new MapCollection<{ id: string, name: string }>(item => item.id);
    const result = coll.update([{ id: '1', name: 'a' }], '1', { name: 'b' });
    expect(result.items).toEqual([{ id: '1', name: 'b' }]);
    expect(result.changed).toBe(true);
    expect(result.item).toEqual({ id: '1', name: 'b' });

    const result2 = coll.update(result.items, '2', { name: 'c' });
    expect(result2.items).toEqual([{ id: '1', name: 'b' }]);
    expect(result2.changed).toBe(false);
    expect(result2.item).toBeNull();
  });

  it('should delete item and resolve deleted item correctly', () => {
    const coll = new MapCollection<{ id: string, name: string }>(item => item.id);
    const result = coll.delete([{ id: '1', name: 'a' }, { id: '2', name: 'b' }], '1');
    expect(result.items).toEqual([{ id: '2', name: 'b' }]);
    expect(result.changed).toBe(true);
    expect(result.item).toEqual({ id: '1', name: 'a' });
  });

  it('should bulk delete items and resolve item as null', () => {
    const coll = new MapCollection<{ id: string, name: string }>(item => item.id);
    const result = coll.bulkDelete([{ id: '1', name: 'a' }, { id: '2', name: 'b' }, { id: '3', name: 'c' }], ['1', '3']);
    expect(result.items).toEqual([{ id: '2', name: 'b' }]);
    expect(result.changed).toBe(true);
    expect(result.item).toBeNull();
  });

  it('should bulk upsert items and resolve item as null when multiple changes occur', () => {
    const coll = new MapCollection<{ id: string, name: string }>(item => item.id);
    const result = coll.bulkUpsert([{ id: '1', name: 'a' }], [{ id: '2', name: 'b' }, { id: '1', name: 'c' }]);
    expect(result.items).toEqual([{ id: '1', name: 'c' }, { id: '2', name: 'b' }]);
    expect(result.changed).toBe(true);
    expect(result.item).toBeNull();
  });

  it('should bulk upsert items and resolve item if exactly one change occurs', () => {
    const coll = new MapCollection<{ id: string, name: string }>(item => item.id);
    const result = coll.bulkUpsert([{ id: '1', name: 'a' }], [{ id: '1', name: 'a' }, { id: '2', name: 'b' }]);
    expect(result.items).toEqual([{ id: '1', name: 'a' }, { id: '2', name: 'b' }]);
    expect(result.changed).toBe(true);
    expect(result.item).toEqual({ id: '2', name: 'b' });
  });

  it('should return item as null if no changes occurred in update', () => {
      const coll = new MapCollection<{ id: string, name: string }>(item => item.id);
      const result = coll.update([{ id: '1', name: 'a' }], '1', { name: 'a' });
      expect(result.changed).toBe(false);
      expect(result.item).toBeNull();
  });
});
