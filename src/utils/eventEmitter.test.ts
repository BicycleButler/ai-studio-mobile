import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from './eventEmitter';

describe('EventEmitter', () => {
    it('should notify listeners on emit', () => {
        const emitter = new EventEmitter<number>();
        const listener = vi.fn();
        emitter.subscribe(listener);

        emitter.emit(42);

        expect(listener).toHaveBeenCalledWith(42);
    });

    it('should allow unsubscribing', () => {
        const emitter = new EventEmitter<number>();
        const listener = vi.fn();
        const unsubscribe = emitter.subscribe(listener);

        unsubscribe();
        emitter.emit(42);

        expect(listener).not.toHaveBeenCalled();
    });
});
