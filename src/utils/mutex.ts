import { ILogger, defaultLogger } from "./logger";
import { IPlatformService, defaultPlatformService } from "../services/platformService";

export interface IMutex {
  acquire(timeoutMs?: number): Promise<() => void>;
  run<T>(task: () => Promise<T>, timeoutMs?: number): Promise<T>;
}

export class Mutex implements IMutex {
  private queue: Promise<void> = Promise.resolve();
  private logger: ILogger;
  private platformService: IPlatformService;

  constructor(logger: ILogger = defaultLogger, platformService: IPlatformService = defaultPlatformService) {
    this.logger = logger;
    this.platformService = platformService;
  }

  public async acquire(timeoutMs?: number): Promise<() => void> {
    let release: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      release = resolve;
    });

    let timeoutId: unknown | undefined;
    let isReleased = false;

    const wrappedRelease = () => {
      if (isReleased) return;
      isReleased = true;
      if (timeoutId) this.platformService.clearTimeout(timeoutId);
      release();
    };

    const previousQueue = this.queue;

    this.queue = previousQueue.then(() => lockPromise).catch(() => lockPromise);

    await previousQueue;

    if (timeoutMs !== undefined) {
      timeoutId = this.platformService.setTimeout(() => {
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
