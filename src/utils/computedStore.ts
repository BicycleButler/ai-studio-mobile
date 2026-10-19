import { Observable, IReadableStore } from "./observable";

export class ComputedStore<T> extends Observable<T> {
  private unsubscribes: Array<() => void> = [];
  private isDirty = false;
  private microtaskQueued = false;

  constructor(
    private stores: IReadableStore<unknown>[],
    private compute: () => T
  ) {
    super(compute());

    // Subscribe to all dependencies
    for (const store of this.stores) {
      this.unsubscribes.push(
        store.subscribe(() => {
          this.markDirty();
        })
      );
    }
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
        }
        this.microtaskQueued = false;

        if (needsNotify) {
          // If we had pending changes (either evaluated locally or in this tick), fire notification
          this.notify(this.currentState as T);
        }
      });
    }
  }

  public override getSnapshot(): T | undefined {
    if (this.isDirty) {
      // Recompute state synchronously for the reader,
      // but leave `microtaskQueued` true so the notification
      // still fires asynchronously to subscribers.
      this.currentState = this.compute();
      this.isDirty = false;
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
