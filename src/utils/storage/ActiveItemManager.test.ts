import { describe, it, expect } from 'vitest';
import { ActiveItemManager } from './ActiveItemManager';
import { defaultStorageFactory } from './StorageFactory';
import { FirstItemSelectionStrategy, NoImplicitSelectionStrategy } from './selectionStrategy';

describe('ActiveItemManager', () => {
    it('should initialize with implicit selection', () => {
        const collection = defaultStorageFactory.createCollection<{ id: string }>('test_col');
        collection.save([{ id: '1' }, { id: '2' }]);
        const activeIdSingleton = defaultStorageFactory.createSingleton<string | null>('test_id', null);

        const manager = new ActiveItemManager({
            collection,
            activeIdSingleton,
            getId: (i) => i.id,
            implicitSelectionStrategy: new FirstItemSelectionStrategy()
        });

        const state = manager.getSnapshot();
        expect(state.items.length).toBe(2);
        expect(state.activeItem).toEqual({ id: '1' });
        expect(manager.getActiveId()).toBe('1');
    });

    it('should initialize with explicit selection', () => {
        const collection = defaultStorageFactory.createCollection<{ id: string }>('test_col');
        collection.save([{ id: '1' }, { id: '2' }]);
        const activeIdSingleton = defaultStorageFactory.createSingleton<string | null>('test_id', '2');

        const manager = new ActiveItemManager({
            collection,
            activeIdSingleton,
            getId: (i) => i.id,
            implicitSelectionStrategy: new FirstItemSelectionStrategy()
        });

        const state = manager.getSnapshot();
        expect(state.activeItem).toEqual({ id: '2' });
        expect(manager.getActiveId()).toBe('2');
    });

    it('should respect allowImplicitSelection=false', () => {
        const collection = defaultStorageFactory.createCollection<{ id: string }>('test_col');
        collection.save([{ id: '1' }, { id: '2' }]);
        const activeIdSingleton = defaultStorageFactory.createSingleton<string | null>('test_id', null);

        const manager = new ActiveItemManager({
            collection,
            activeIdSingleton,
            getId: (i) => i.id,
            implicitSelectionStrategy: new NoImplicitSelectionStrategy()
        });

        const state = manager.getSnapshot();
        expect(state.activeItem).toBeNull();
        expect(manager.getActiveId()).toBeNull();
    });

    it('should update state when collection changes', async () => {
        const collection = defaultStorageFactory.createCollection<{ id: string }>('test_col');
        const activeIdSingleton = defaultStorageFactory.createSingleton<string | null>('test_id', null);

        const manager = new ActiveItemManager({
            collection,
            activeIdSingleton,
            getId: (i) => i.id,
            implicitSelectionStrategy: new FirstItemSelectionStrategy()
        });

        collection.save([{ id: '3' }]);

        // We need to wait for microtask since it uses ComputedStore
        await Promise.resolve();

        const state = manager.getSnapshot();
        expect(state.items.length).toBe(1);
        expect(state.activeItem).toEqual({ id: '3' });
    });


    it('should handle dangling IDs on an empty collection', () => {
        const collection = defaultStorageFactory.createCollection<{ id: string }>('test_col');
        collection.save([]);
        const activeIdSingleton = defaultStorageFactory.createSingleton<string | null>('test_id', 'dangling_id');

        const manager = new ActiveItemManager({
            collection,
            activeIdSingleton,
            getId: (i) => i.id,
            implicitSelectionStrategy: new FirstItemSelectionStrategy()
        });

        const state = manager.getSnapshot();
        expect(state.items.length).toBe(0);
        expect(state.activeItem).toBeNull();
        expect(manager.getActiveId()).toBeNull();
    });
});
