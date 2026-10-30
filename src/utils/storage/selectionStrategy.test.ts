import { describe, it, expect } from 'vitest';
import { FirstItemSelectionStrategy, NoImplicitSelectionStrategy } from './selectionStrategy';

describe('SelectionStrategies', () => {
    describe('FirstItemSelectionStrategy', () => {
        it('should return the first item if array is not empty', () => {
            const strategy = new FirstItemSelectionStrategy<{id: string}>();
            const items = [{id: '1'}, {id: '2'}];
            expect(strategy.selectImplicitItem(items, i => i.id)).toEqual({id: '1'});
        });
        it('should return null if array is empty', () => {
            const strategy = new FirstItemSelectionStrategy<{id: string}>();
            const items: {id: string}[] = [];
            expect(strategy.selectImplicitItem(items, i => i.id)).toBeNull();
        });
    });
    describe('NoImplicitSelectionStrategy', () => {
        it('should return null regardless of array contents', () => {
            const strategy = new NoImplicitSelectionStrategy<{id: string}>();
            const items = [{id: '1'}, {id: '2'}];
            expect(strategy.selectImplicitItem(items, i => i.id)).toBeNull();
            expect(strategy.selectImplicitItem([], i => i.id)).toBeNull();
        });
    });
});
