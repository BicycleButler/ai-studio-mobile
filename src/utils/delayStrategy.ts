export interface IDelayStrategy {
  getNextDelayMs(attempt: number, lastError?: unknown): number;
}

export class FixedIntervalDelayStrategy implements IDelayStrategy {
  constructor(private intervalMs: number = 2500) {}

  getNextDelayMs(_attempt: number, _lastError?: unknown): number {
    return this.intervalMs;
  }
}

export class ExponentialBackoffDelayStrategy implements IDelayStrategy {
  constructor(
    private baseDelayMs: number = 2500,
    private maxDelayMs: number = 30000,
    private multiplier: number = 2,
    private jitterMax: number = 500
  ) {}

  getNextDelayMs(attempt: number, lastError?: unknown): number {
    if (lastError) {
      // If there's an error, apply exponential backoff
      const backoff = this.baseDelayMs * Math.pow(this.multiplier, attempt - 1);
      const delay = Math.min(backoff, this.maxDelayMs);
      return delay + Math.random() * this.jitterMax; // Add jitter
    }
    // No error, keep the base delay
    return this.baseDelayMs;
  }
}
