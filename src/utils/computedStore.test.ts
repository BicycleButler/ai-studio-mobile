import { describe, it, expect } from 'vitest';
import { Observable } from './observable';
import { ComputedStore } from './computedStore';

describe('ComputedStore', () => {
  it('should compute initial state', () => {
    const store1 = new Observable(1);
    const store2 = new Observable(2);

    const computed = new ComputedStore([store1, store2], () => {
      return (store1.getSnapshot() || 0) + (store2.getSnapshot() || 0);
    });

    expect(computed.getSnapshot()).toBe(3);
  });

  it('should recompute state on dependency change', async () => {
    const store1 = new Observable(1);
    const store2 = new Observable(2);

    const computed = new ComputedStore([store1, store2], () => {
      return (store1.getSnapshot() || 0) + (store2.getSnapshot() || 0);
    });

    expect(computed.getSnapshot()).toBe(3);

    store1.notify(5);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(computed.getSnapshot()).toBe(7);

    store2.notify(10);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(computed.getSnapshot()).toBe(15);
  });

  it('should notify subscribers on change asynchronously and batch multiple updates', async () => {
    const store1 = new Observable(1);

    let computeCount = 0;
    const computed = new ComputedStore([store1], () => {
      computeCount++;
      return (store1.getSnapshot() || 0) * 2;
    });

    let notifiedValue = 0;
    let notifyCount = 0;
    computed.subscribe(val => {
      notifiedValue = val;
      notifyCount++;
    });

    // Reset computeCount after initial compute
    computeCount = 0;

    store1.notify(5);
    store1.notify(10);
    store1.notify(20);

    // Synchronous state should not have changed yet if we don't call getSnapshot
    expect(notifyCount).toBe(0);

    // Force microtasks to resolve
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(notifiedValue).toBe(40);
    expect(notifyCount).toBe(1);
    expect(computeCount).toBe(1); // Should only compute once for the batch
  });

  it('should still notify if getSnapshot is called during a dirty window', async () => {
    const store1 = new Observable(1);

    let computeCount = 0;
    const computed = new ComputedStore([store1], () => {
      computeCount++;
      return (store1.getSnapshot() || 0) * 2;
    });

    let notifiedValue = 0;
    let notifyCount = 0;
    computed.subscribe(val => {
      notifiedValue = val;
      notifyCount++;
    });

    computeCount = 0;

    store1.notify(5);

    // We must wait for Observable's microtask to mark computed as dirty
    await new Promise(resolve => queueMicrotask(() => resolve(undefined)));

    // Call getSnapshot synchronously while dirty
    expect(computed.getSnapshot()).toBe(10);
    expect(computeCount).toBe(1); // Evaluated synchronously

    // But ComputedStore notification hasn't fired yet
    expect(notifyCount).toBe(0);

    // Wait for ComputedStore's microtask
    await new Promise(resolve => queueMicrotask(() => resolve(undefined)));

    // Notification should fire with the updated value
    expect(notifyCount).toBe(1);
    expect(notifiedValue).toBe(10);
    // Should not recompute again in the microtask since it was already resolved
    expect(computeCount).toBe(1);
  });

  it('should clean up subscriptions on dispose', () => {
    const store1 = new Observable(1);

    const computed = new ComputedStore([store1], () => {
      return (store1.getSnapshot() || 0) * 2;
    });

    computed.dispose();

    store1.notify(5);
    expect(computed.getSnapshot()).toBe(2); // Should not have been recomputed
  });
});
