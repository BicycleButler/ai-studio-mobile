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

  it('should recompute state on dependency change', () => {
    const store1 = new Observable(1);
    const store2 = new Observable(2);

    const computed = new ComputedStore([store1, store2], () => {
      return (store1.getSnapshot() || 0) + (store2.getSnapshot() || 0);
    });

    expect(computed.getSnapshot()).toBe(3);

    store1.notify(5);
    expect(computed.getSnapshot()).toBe(7);

    store2.notify(10);
    expect(computed.getSnapshot()).toBe(15);
  });

  it('should notify subscribers on change', () => {
    const store1 = new Observable(1);

    const computed = new ComputedStore([store1], () => {
      return (store1.getSnapshot() || 0) * 2;
    });

    let notifiedValue = 0;
    computed.subscribe(val => {
      notifiedValue = val;
    });

    store1.notify(5);
    expect(notifiedValue).toBe(10);
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
