export interface StreamCoalescerOptions {
  intervalMs?: number;
  schedule?: (cb: () => void, delayMs: number) => unknown;
  cancelSchedule?: (handle: unknown) => void;
  now?: () => number;
}

export interface StreamCoalescer<T> {
  push(value: T): void;
  flush(): void;
  cancel(): void;
}

/**
 * Coalesces rapid streaming updates to a bounded cadence while emitting
 * the very first chunk immediately for minimal Time-To-First-Token (TTFT)
 * and guaranteeing the final value is delivered on flush().
 */
export function createStreamCoalescer<T>(
  onEmit: (value: T) => void,
  options: StreamCoalescerOptions = {}
): StreamCoalescer<T> {
  const intervalMs = options.intervalMs ?? 32;
  const schedule = options.schedule ?? ((cb, delay) => setTimeout(cb, delay));
  const cancelSchedule =
    options.cancelSchedule ??
    ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const now = options.now ?? (() => Date.now());

  let pendingValue: T | undefined;
  let hasPending = false;
  let timerHandle: unknown = null;
  let lastEmitTime = -Infinity;
  let cancelled = false;

  const emitNow = (value: T) => {
    lastEmitTime = now();
    hasPending = false;
    pendingValue = undefined;
    onEmit(value);
  };

  const clearTimer = () => {
    if (timerHandle !== null) {
      cancelSchedule(timerHandle);
      timerHandle = null;
    }
  };

  return {
    push(value: T) {
      if (cancelled) return;

      if (intervalMs <= 0) {
        emitNow(value);
        return;
      }

      const elapsed = now() - lastEmitTime;
      if (elapsed >= intervalMs && timerHandle === null) {
        emitNow(value);
        return;
      }

      pendingValue = value;
      hasPending = true;

      if (timerHandle === null) {
        const remaining = Math.max(0, intervalMs - elapsed);
        timerHandle = schedule(() => {
          timerHandle = null;
          if (!cancelled && hasPending) {
            const toEmit = pendingValue as T;
            emitNow(toEmit);
          }
        }, remaining);
      }
    },

    flush() {
      if (cancelled) return;
      clearTimer();
      if (hasPending) {
        const toEmit = pendingValue as T;
        emitNow(toEmit);
      }
    },

    cancel() {
      cancelled = true;
      hasPending = false;
      pendingValue = undefined;
      clearTimer();
    },
  };
}
