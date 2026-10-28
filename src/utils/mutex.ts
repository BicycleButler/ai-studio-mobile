import { ILogger, defaultLogger } from "./logger";

export interface IMutex {
  acquire(timeoutMs?: number): Promise<() => void>;
  run<T>(task: () => Promise<T>, timeoutMs?: number): Promise<T>;
}

export class Mutex implements IMutex {
  private queue: Promise<void> = Promise.resolve();
  private logger: ILogger;

  constructor(logger: ILogger = defaultLogger) {
    this.logger = logger;
  }

  public async acquire(timeoutMs?: number): Promise<() => void> {
    let release: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      release = resolve;
    });

    let timeoutId: NodeJS.Timeout | undefined;
    let isReleased = false;

    const wrappedRelease = () => {
      if (isReleased) return;
      isReleased = true;
      if (timeoutId) globalThis.clearTimeout(timeoutId);
      release();
    };

    const previousQueue = this.queue;

    this.queue = previousQueue.then(() => lockPromise).catch(() => lockPromise);

    await previousQueue;

    if (timeoutMs !== undefined) {
      timeoutId = globalThis.setTimeout(() => {
        if (!isReleased) {
           this.logger.warn(`Mutex lock timed out after ${timeoutMs}ms`);
           wrappedRelease();
        }
      }, timeoutMs);
    }

    return wrappedRelease;
  }

  public async run<T>(task: () => Promise<T>, timeoutMs?: number): Promise<T> {
    const release = await this.acquire(timeoutMs);
    try {
      return await task();
    } finally {
      release();
    }
  }
}
