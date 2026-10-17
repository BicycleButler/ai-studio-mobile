export type Listener<T> = (state: T) => void;

export class Observable<T> {
  protected listeners = new Set<Listener<T>>();

  public subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public notify(state: T): void {
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err: unknown) {
        console.error("Error in listener:", err);
      }
    }
  }
}
