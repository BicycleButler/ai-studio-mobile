import { Observable, IReadableStore } from "./observable";

export class ComputedStore<T> extends Observable<T> {
  private unsubscribes: Array<() => void> = [];
  private isDirty = false;
  private microtaskQueued = false;
  private lastKnownDependencies: unknown[] = [];
  private isDisposed = false;

  constructor(
    private stores: IReadableStore<unknown>[],
    private compute: () => T
  ) {
    super(compute());
    this.updateLastKnownDependencies();
  }

  private startObservingDependencies() {
    if (this.unsubscribes.length > 0) return;

    if (this.checkDependenciesChanged()) {
      this.currentState = this.compute();
      this.updateLastKnownDependencies();
    }

    for (const store of this.stores) {
      this.unsubscribes.push(
        store.subscribe(() => {
          this.markDirty();
        })
      );
    }
  }

  private stopObservingDependencies() {
    for (const unsub of this.unsubscribes) {
      unsub();
    }
    this.unsubscribes = [];
  }

  public override subscribe(listener: import("./observable").Listener<T>): () => void {
    const isFirstSubscriber = this.listeners.size === 0;
    const unsubscribeSuper = super.subscribe(listener);

    if (isFirstSubscriber) {
      this.startObservingDependencies();
    }

    return () => {
      unsubscribeSuper();
      if (this.listeners.size === 0) {
        this.stopObservingDependencies();
      }
    };
  }

  private updateLastKnownDependencies() {
    this.lastKnownDependencies = this.stores.map((s) => s.getSnapshot());
  }

  private checkDependenciesChanged(): boolean {
    for (let i = 0; i < this.stores.length; i++) {
      if (this.stores[i].getSnapshot() !== this.lastKnownDependencies[i]) {
        return true;
      }
    }
    return false;
  }

  private markDirty() {
    this.isDirty = true;
    if (!this.microtaskQueued) {
      this.microtaskQueued = true;
      queueMicrotask(() => {
        const needsNotify = this.isDirty || this.microtaskQueued; // notify if still queued, even if evaluated
        if (this.isDirty) {
          this.currentState = this.compute();
          this.isDirty = false;
          this.updateLastKnownDependencies();
        }
        this.microtaskQueued = false;

        if (needsNotify) {
          // If we had pending changes (either evaluated locally or in this tick), fire notification
          this.notifySync(this.currentState as T);
        }
      });
    }
  }

  public override getSnapshot(): T {
    if (this.isDisposed) {
      return super.getSnapshot();
    }

    const isObserved = this.unsubscribes.length > 0;

    if (!isObserved) {
      if (this.checkDependenciesChanged()) {
        this.currentState = this.compute();
        this.updateLastKnownDependencies();
      }
    } else {
      if (this.isDirty || this.checkDependenciesChanged()) {
        this.currentState = this.compute();
        this.isDirty = false;
        this.updateLastKnownDependencies();
      }
    }
    return super.getSnapshot();
  }

  public dispose() {
    this.isDisposed = true;
    this.stopObservingDependencies();
    this.clearListeners();
  }
}
