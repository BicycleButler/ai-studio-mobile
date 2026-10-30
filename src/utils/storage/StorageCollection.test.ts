import { describe, it, expect } from 'vitest';
import { defaultStorageFactory } from './StorageFactory';

describe('StorageCollection', () => {
  it('should initialize and return correctly', () => {
    const collection = defaultStorageFactory.createCollection<{ id: string }>('test_col');
    expect(collection.load()).toEqual([]);
  });

  it('should apply maxItems logic', () => {
    const collection = defaultStorageFactory.createCollection<{ id: string }>('test_col', { maxItems: 2 });
    collection.save([{ id: '1' }, { id: '2' }, { id: '3' }]);
    expect(collection.load()).toEqual([{ id: '1' }, { id: '2' }]);
  });

  it('should validate and transformOut items', () => {
    const collection = defaultStorageFactory.createCollection<{ id: string, val?: number }>('test_col', {
        validate: (i) => ((i as {val?: number}).val || 0) > 0,
        transformOut: (i) => ({ ...i, val: (i.val || 0) * 2 })
    });
    // save bypasses transformOut, it only runs when read. Wait, transformIn runs on save.
    // Let's test the pipeline directly.
    collection.save([{ id: '1', val: 1 }, { id: '2', val: -1 }, { id: '3', val: 2 }]);
    const loaded = collection.load();
    expect(loaded).toEqual([{ id: '1', val: 2 }, { id: '3', val: 4 }]);
  });

  it('should bulkUpsert items correctly', () => {
    const collection = defaultStorageFactory.createCollection<{ id: string }>('test_col');
    collection.save([{ id: '1' }]);
    collection.bulkUpsert([{ id: '2' }, { id: '1' }]);
    expect(collection.load()).toEqual([{ id: '1' }, { id: '2' }]);
  });
});
