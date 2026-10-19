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

  public clearListeners(): void {
    this.listeners.clear();
  }
}
