export interface PollingOptions<T> {
  intervalMs?: number;
  onUpdate: (data: T) => void;
  onError?: (error: unknown) => void;
  isComplete?: (data: T) => boolean;
}

export function startPolling<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: PollingOptions<T>
): { stop: () => void } {
  const { intervalMs = 2500, onUpdate, onError, isComplete } = options;
  let stopped = false;
  let abortController = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const runPoll = async () => {
    if (stopped) return;
    try {
      const data = await fetcher(abortController.signal);
      if (!stopped) {
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
      if (!stopped && onError) {
        onError(err);
      }
    }

    if (!stopped) {
      timer = setTimeout(runPoll, intervalMs);
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
