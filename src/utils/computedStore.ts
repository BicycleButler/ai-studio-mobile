import { Observable, IReadableStore } from "./observable";

export class ComputedStore<T> extends Observable<T> {
  private unsubscribes: Array<() => void> = [];

  constructor(
    private stores: IReadableStore<unknown>[],
    private compute: () => T
  ) {
    super(compute());

    // Subscribe to all dependencies
    for (const store of this.stores) {
      this.unsubscribes.push(
        store.subscribe(() => {
          this.recompute();
        })
      );
    }
  }

  private recompute() {
    this.notify(this.compute());
  }

  public dispose() {
    for (const unsub of this.unsubscribes) {
      unsub();
    }
    this.unsubscribes = [];
    this.clearListeners();
  }
}
