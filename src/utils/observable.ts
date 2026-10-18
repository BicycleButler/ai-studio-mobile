export type Listener<T> = (state: T) => void;

export class Observable<T> {
  protected listeners = new Set<Listener<T>>();

  public subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  protected currentState?: T;

  public notify(state: T): void {
    this.currentState = state;
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err: unknown) {
        console.error("Error in listener:", err);
      }
    }
  }

  public getSnapshot(): T | undefined {
    return this.currentState;
  }

  public bindSubscribe = (listener: () => void): () => void => {
    return this.subscribe(listener);
  };
}
