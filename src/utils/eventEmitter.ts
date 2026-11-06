import { ILogger, DefaultLoggerFactory } from "./logger";

export type EventListener<T> = (payload: T) => void;

export interface IEventEmitter<T> {
  subscribe(listener: EventListener<T>): () => void;
  emit(payload: T): void;
  clearListeners(): void;
}

export class EventEmitter<T> implements IEventEmitter<T> {
  protected logger: ILogger;
  protected listeners = new Set<EventListener<T>>();

  constructor(logger: ILogger = new DefaultLoggerFactory().createLogger()) {
    this.logger = logger;
  }

  public subscribe(listener: EventListener<T>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public emit(payload: T): void {
    for (const listener of this.listeners) {
      try {
        listener(payload);
      } catch (err: unknown) {
        this.logger.error("Error in event listener:", err);
      }
    }
  }

  public clearListeners(): void {
    this.listeners.clear();
  }
}
