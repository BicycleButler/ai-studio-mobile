import { describe, it, expect, vi } from 'vitest';
import { Observable } from './observable';

describe('Observable Batching', () => {
    it('should batch multiple notify calls into one listener update via microtask', async () => {
        const obs = new Observable<number>(0);
        const listener = vi.fn();
        obs.subscribe(listener);

        // Call multiple times synchronously
        obs.notify(1);
        obs.notify(2);
        obs.notify(3);

        // Listener must not be called yet
        expect(listener).not.toHaveBeenCalled();

        // Let microtasks run
        await Promise.resolve();

        // Must only be called once with the final state
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(3);
    });

    it('notifySync should update listeners immediately and cancel pending async', async () => {
        const obs = new Observable<number>(0);
        const listener = vi.fn();
        obs.subscribe(listener);

        obs.notify(1); // Queue async update
        obs.notifySync(2); // Execute sync update, must cancel async

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(2);

        // Let microtasks run
        await Promise.resolve();

        // Must not have been called again by the async flush
        expect(listener).toHaveBeenCalledTimes(1);
    });
});
