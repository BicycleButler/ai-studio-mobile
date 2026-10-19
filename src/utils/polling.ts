export interface IPollingStrategy {
  getNextDelayMs(attempt: number, lastError?: unknown): number;
}

export class FixedIntervalPollingStrategy implements IPollingStrategy {
  constructor(private intervalMs: number = 2500) {}

  getNextDelayMs(_attempt: number, _lastError?: unknown): number {
    return this.intervalMs;
  }
}

export class ExponentialBackoffPollingStrategy implements IPollingStrategy {
  constructor(
    private baseDelayMs: number = 2500,
    private maxDelayMs: number = 30000,
    private multiplier: number = 2
  ) {}

  getNextDelayMs(attempt: number, lastError?: unknown): number {
    if (lastError) {
      // If there's an error, apply exponential backoff
      const backoff = this.baseDelayMs * Math.pow(this.multiplier, attempt - 1);
      const delay = Math.min(backoff, this.maxDelayMs);
      return delay + Math.random() * 500; // Add jitter
    }
    // No error, keep the base delay
    return this.baseDelayMs;
  }
}

export interface PollingOptions<T> {
  intervalMs?: number; // Kept for backwards compatibility
  strategy?: IPollingStrategy;
  onUpdate: (data: T) => void;
  onError?: (error: unknown) => void;
  isComplete?: (data: T) => boolean;
}

export function startPolling<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: PollingOptions<T>
): { stop: () => void } {
  const { onUpdate, onError, isComplete } = options;
  const strategy = options.strategy || new FixedIntervalPollingStrategy(options.intervalMs ?? 2500);

  let stopped = false;
  let abortController = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let lastError: unknown = undefined;

  const runPoll = async () => {
    if (stopped) return;
    attempt++;

    try {
      const data = await fetcher(abortController.signal);
      if (!stopped) {
        lastError = undefined; // clear previous error on success
        attempt = 0; // reset attempt counter on success if desired, but we can also just keep it
                     // We reset it so that backoff resets when it recovers
        onUpdate(data);
        if (isComplete && isComplete(data)) {
          stopped = true;
          return; // Stop scheduling next tick
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      if (!stopped) {
        lastError = err;
        if (onError) {
          onError(err);
        }
      }
    }

    if (!stopped) {
      const delay = strategy.getNextDelayMs(attempt, lastError);
      timer = setTimeout(runPoll, delay);
    }
  };

  timer = setTimeout(runPoll, 0); // start immediately

  return {
    stop: () => {
      stopped = true;
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      abortController.abort();
    },
  };
}
