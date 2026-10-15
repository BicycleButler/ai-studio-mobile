export class Mutex {
  private queue: Promise<void> = Promise.resolve();

  async acquire(): Promise<() => void> {
    let release: () => void = () => {};
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });

    const current = this.queue;
    this.queue = this.queue.then(() => next);

    await current;
    return release;
  }

  async runExclusive<T>(task: () => Promise<T> | T): Promise<T> {
    const release = await this.acquire();
    try {
      return await task();
    } finally {
      release();
    }
  }
}
