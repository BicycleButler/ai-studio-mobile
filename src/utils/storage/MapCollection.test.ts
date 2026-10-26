import { describe, it, expect } from 'vitest';
import { MapCollection } from './MapCollection';

describe('MapCollection', () => {
  it('should initialize correctly', () => {
    const coll = new MapCollection<{ id: string }>(item => item.id);
    expect(coll).toBeDefined();
  });

  it('should upsert item', () => {
    const coll = new MapCollection<{ id: string, name: string }>(item => item.id);
    const result = coll.upsert([], { id: '1', name: 'a' });
    expect(result.items).toEqual([{ id: '1', name: 'a' }]);
    expect(result.changed).toBe(true);

    const result2 = coll.upsert(result.items, { id: '1', name: 'b' });
    expect(result2.items).toEqual([{ id: '1', name: 'b' }]);
    expect(result2.changed).toBe(true);
  });

  it('should update item', () => {
    const coll = new MapCollection<{ id: string, name: string }>(item => item.id);
    const result = coll.update([{ id: '1', name: 'a' }], '1', { name: 'b' });
    expect(result.items).toEqual([{ id: '1', name: 'b' }]);
    expect(result.changed).toBe(true);

    const result2 = coll.update(result.items, '2', { name: 'c' });
    expect(result2.items).toEqual([{ id: '1', name: 'b' }]);
    expect(result2.changed).toBe(false);
  });

  it('should delete item', () => {
    const coll = new MapCollection<{ id: string, name: string }>(item => item.id);
    const result = coll.delete([{ id: '1', name: 'a' }, { id: '2', name: 'b' }], '1');
    expect(result.items).toEqual([{ id: '2', name: 'b' }]);
    expect(result.changed).toBe(true);
  });

  it('should bulk delete items', () => {
    const coll = new MapCollection<{ id: string, name: string }>(item => item.id);
    const result = coll.bulkDelete([{ id: '1', name: 'a' }, { id: '2', name: 'b' }, { id: '3', name: 'c' }], ['1', '3']);
    expect(result.items).toEqual([{ id: '2', name: 'b' }]);
    expect(result.changed).toBe(true);
  });

  it('should bulk upsert items', () => {
    const coll = new MapCollection<{ id: string, name: string }>(item => item.id);
    const result = coll.bulkUpsert([{ id: '1', name: 'a' }], [{ id: '2', name: 'b' }, { id: '1', name: 'c' }]);
    expect(result.items).toEqual([{ id: '1', name: 'c' }, { id: '2', name: 'b' }]);
    expect(result.changed).toBe(true);
  });
});
