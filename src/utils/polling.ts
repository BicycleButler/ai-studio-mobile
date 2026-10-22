import { IDelayStrategy, FixedIntervalDelayStrategy, ExponentialBackoffDelayStrategy } from "./delayStrategy";

export interface IPollingStrategy extends IDelayStrategy {}

export class FixedIntervalPollingStrategy extends FixedIntervalDelayStrategy implements IPollingStrategy {}

export class ExponentialBackoffPollingStrategy extends ExponentialBackoffDelayStrategy implements IPollingStrategy {}

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
  let strategy = options.strategy || new FixedIntervalPollingStrategy(options.intervalMs ?? 2500);

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
