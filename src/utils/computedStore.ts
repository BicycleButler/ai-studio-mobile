import { Observable, IReadableStore } from "./observable";

export class ComputedStore<T> extends Observable<T> {
  private unsubscribes: Array<() => void> = [];
  private isDirty = false;
  private microtaskQueued = false;
  private lastKnownDependencies: unknown[] = [];

  constructor(
    private stores: IReadableStore<unknown>[],
    private compute: () => T
  ) {
    super(compute());
    this.updateLastKnownDependencies();

    // Subscribe to all dependencies
    for (const store of this.stores) {
      this.unsubscribes.push(
        store.subscribe(() => {
          this.markDirty();
        })
      );
    }
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

  public override getSnapshot(): T | undefined {
    // Only check for dependencies changing dynamically if we are still active (not disposed)
    if (this.isDirty || (this.unsubscribes.length > 0 && this.checkDependenciesChanged())) {
      // Recompute state synchronously for the reader,
      // but leave `microtaskQueued` true so the notification
      // still fires asynchronously to subscribers.
      this.currentState = this.compute();
      this.isDirty = false;
      this.updateLastKnownDependencies();
    }
    return super.getSnapshot();
  }

  public dispose() {
    for (const unsub of this.unsubscribes) {
      unsub();
    }
    this.unsubscribes = [];
    this.clearListeners();
  }
}
