export class Mutex {
  private queue: Promise<void> = Promise.resolve();

  public async acquire(): Promise<() => void> {
    let release: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      release = resolve;
    });

    const previousQueue = this.queue;
    this.queue = previousQueue.then(() => lockPromise).catch(() => lockPromise);

    await previousQueue;
    return release!;
  }

  public async run<T>(task: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await task();
    } finally {
      release();
    }
  }
}
