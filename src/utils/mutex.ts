export class Mutex {
  private queue: Promise<void> = Promise.resolve();

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
      if (timeoutId) clearTimeout(timeoutId);
      release();
    };

    const previousQueue = this.queue;

    this.queue = previousQueue.then(() => lockPromise).catch(() => lockPromise);

    await previousQueue;

    if (timeoutMs !== undefined) {
      timeoutId = setTimeout(() => {
        if (!isReleased) {
           console.warn(`Mutex lock timed out after ${timeoutMs}ms`);
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
