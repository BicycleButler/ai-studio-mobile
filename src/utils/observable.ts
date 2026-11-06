import { ILogger, DefaultLoggerFactory } from "./logger";

export type Listener<T> = (state: T) => void;

export interface IReadableStore<T> {
  subscribe(listener: Listener<T>): () => void;
  getSnapshot(): T;
}

export interface IObservable<T> extends IReadableStore<T> {
  notify(state: T): void;
  notifySync(state: T): void;
  clearListeners(): void;
}

export class Observable<T> implements IObservable<T> {
  protected logger: ILogger;
  protected listeners = new Set<Listener<T>>();
  protected currentState: T;
  private isNotificationPending = false;

  constructor(initialState: T, logger: ILogger = new DefaultLoggerFactory().createLogger()) {
    this.logger = logger;
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

    if (!this.isNotificationPending) {
      this.isNotificationPending = true;
      queueMicrotask(() => {
        if (!this.isNotificationPending) return;
        this.isNotificationPending = false;
        const snapshot = this.currentState;
        for (const listener of this.listeners) {
          try {
            listener(snapshot);
          } catch (err: unknown) {
            this.logger.error("Error in listener:", err);
          }
        }
      });
    }
  }

  public notifySync(state: T): void {
    this.currentState = state;
    this.isNotificationPending = false;
    const snapshot = this.currentState;
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err: unknown) {
        this.logger.error("Error in listener:", err);
      }
    }
  }

  public getSnapshot(): T {
    return this.currentState;
  }

  public clearListeners(): void {
    this.listeners.clear();
  }
}
