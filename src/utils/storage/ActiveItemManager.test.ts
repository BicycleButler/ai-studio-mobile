import { describe, it, expect, vi } from 'vitest';
import { ActiveItemManager } from './ActiveItemManager';
import { StorageCollection } from './StorageCollection';
import { StorageSingleton } from './StorageSingleton';

describe('ActiveItemManager', () => {
    it('should initialize with implicit selection', () => {
        const collection = new StorageCollection<{ id: string }>('test_col');
        collection.save([{ id: '1' }, { id: '2' }]);
        const activeIdSingleton = new StorageSingleton<string | null>('test_id', null);

        const manager = new ActiveItemManager({
            collection,
            activeIdSingleton,
            getId: (i) => i.id
        });

        const state = manager.getSnapshot();
        expect(state.items.length).toBe(2);
        expect(state.activeItem).toEqual({ id: '1' });
        expect(manager.getActiveId()).toBe('1');
    });

    it('should initialize with explicit selection', () => {
        const collection = new StorageCollection<{ id: string }>('test_col');
        collection.save([{ id: '1' }, { id: '2' }]);
        const activeIdSingleton = new StorageSingleton<string | null>('test_id', '2');

        const manager = new ActiveItemManager({
            collection,
            activeIdSingleton,
            getId: (i) => i.id
        });

        const state = manager.getSnapshot();
        expect(state.activeItem).toEqual({ id: '2' });
        expect(manager.getActiveId()).toBe('2');
    });

    it('should respect allowImplicitSelection=false', () => {
        const collection = new StorageCollection<{ id: string }>('test_col');
        collection.save([{ id: '1' }, { id: '2' }]);
        const activeIdSingleton = new StorageSingleton<string | null>('test_id', null);

        const manager = new ActiveItemManager({
            collection,
            activeIdSingleton,
            getId: (i) => i.id,
            allowImplicitSelection: false
        });

        const state = manager.getSnapshot();
        expect(state.activeItem).toBeNull();
        expect(manager.getActiveId()).toBeNull();
    });

    it('should update state when collection changes', async () => {
        const collection = new StorageCollection<{ id: string }>('test_col');
        const activeIdSingleton = new StorageSingleton<string | null>('test_id', null);

        const manager = new ActiveItemManager({
            collection,
            activeIdSingleton,
            getId: (i) => i.id
        });

        collection.save([{ id: '3' }]);

        // We need to wait for microtask since it uses ComputedStore
        await Promise.resolve();

        const state = manager.getSnapshot();
        expect(state.items.length).toBe(1);
        expect(state.activeItem).toEqual({ id: '3' });
    });

    it('should fire onActiveItemChange callback', async () => {
        const collection = new StorageCollection<{ id: string }>('test_col');
        collection.save([{ id: '1' }, { id: '2' }]);
        const activeIdSingleton = new StorageSingleton<string | null>('test_id', '1');

        const changeSpy = vi.fn();
        const manager = new ActiveItemManager({
            collection,
            activeIdSingleton,
            getId: (i) => i.id,
            onActiveItemChange: changeSpy
        });

        manager.setActiveId('2');

        // Allow microtasks to settle
        await Promise.resolve();

        // Wait for microtask-based observer notification which triggers the side effect
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(changeSpy).toHaveBeenCalledWith({ id: '2' });
    });

    it('should handle dangling IDs on an empty collection', () => {
        const collection = new StorageCollection<{ id: string }>('test_col');
        collection.save([]);
        const activeIdSingleton = new StorageSingleton<string | null>('test_id', 'dangling_id');

        const manager = new ActiveItemManager({
            collection,
            activeIdSingleton,
            getId: (i) => i.id
        });

        const state = manager.getSnapshot();
        expect(state.items.length).toBe(0);
        expect(state.activeItem).toBeNull();
        expect(manager.getActiveId()).toBeNull();
    });
});
