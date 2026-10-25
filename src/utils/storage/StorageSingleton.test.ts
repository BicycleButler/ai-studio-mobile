import { describe, it, expect, vi } from 'vitest';
import { StorageSingleton } from './StorageSingleton';
import { MemoryStorage } from './core';

describe('StorageSingleton', () => {
  it('should initialize and return correctly with fallback', () => {
    const memory = new MemoryStorage();
    const singleton = new StorageSingleton<{ data: string }>('test_singleton', { data: 'fallback' }, { storageAdapter: memory });
    expect(singleton.load()).toEqual({ data: 'fallback' });
  });

  it('should save and load correctly', () => {
    const memory = new MemoryStorage();
    const singleton = new StorageSingleton<{ data: string }>('test_singleton', { data: 'fallback' }, { storageAdapter: memory });
    singleton.save({ data: 'saved' });
    expect(singleton.load()).toEqual({ data: 'saved' });
  });

  it('should transform data correctly', () => {
    const memory = new MemoryStorage();
    const singleton = new StorageSingleton<{ data: string }>('test_singleton', { data: 'fallback' }, {
      storageAdapter: memory,
      transformIn: (i) => ({ data: i.data + '_in' }),
      transformOut: (i) => ({ data: i.data + '_out' })
    });

    singleton.save({ data: 'raw' }); // becomes 'raw_in'

    const loaded = singleton.load(); // reads 'raw_in', returns 'raw_in_out'
    expect(loaded).toEqual({ data: 'raw_in_out' });
  });

  it('should fallback on validation failure', () => {
    const memory = new MemoryStorage();
    const singleton = new StorageSingleton<{ data: string }>('test_singleton', { data: 'fallback' }, {
      storageAdapter: memory,
      validate: (i: any) => i.data === 'valid'
    });

    singleton.save({ data: 'invalid' });
    expect(singleton.load()).toEqual({ data: 'fallback' });

    singleton.save({ data: 'valid' });
    expect(singleton.load()).toEqual({ data: 'valid' });
  });
});
