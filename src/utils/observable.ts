export type Listener<T> = (state: T) => void;

export interface IReadableStore<T> {
  subscribe(listener: Listener<T>): () => void;
  getSnapshot(): T | undefined;
}

export interface IObservable<T> extends IReadableStore<T> {
  notify(state: T): void;
  clearListeners(): void;
}

export class Observable<T> implements IObservable<T> {
  protected listeners = new Set<Listener<T>>();
  protected currentState?: T;
  private isNotificationPending = false;

  constructor(initialState?: T) {
    this.currentState = initialState;
  }

  public subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public notify(state: T): void {
    this.currentState = state;

    // Batch notifications via microtask to prevent render thrashing
    // if multiple synchronous updates occur in the same tick.
    if (!this.isNotificationPending) {
      this.isNotificationPending = true;
      queueMicrotask(() => {
        if (!this.isNotificationPending) return;
        this.isNotificationPending = false;
        const snapshot = this.currentState as T;
        for (const listener of this.listeners) {
          try {
            listener(snapshot);
          } catch (err: unknown) {
            console.error("Error in listener:", err);
          }
        }
      });
    }
  }

  public getSnapshot(): T | undefined {
    return this.currentState;
  }

  public clearListeners(): void {
    this.listeners.clear();
  }
}
