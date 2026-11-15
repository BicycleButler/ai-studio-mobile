export interface IDelayStrategy {
  getNextDelayMs(attempt: number, lastError?: unknown): number;
  withBaseDelay(delay: number): IDelayStrategy;
}

export class FixedIntervalDelayStrategy implements IDelayStrategy {
  constructor(private intervalMs: number = 2500) {}

  getNextDelayMs(_attempt: number, _lastError?: unknown): number {
    return this.intervalMs;
  }

  withBaseDelay(delay: number): IDelayStrategy {
    return new FixedIntervalDelayStrategy(delay);
  }
}

import { IRandomProvider, DefaultRandomProvider } from "./randomProvider";

export class ExponentialBackoffDelayStrategy implements IDelayStrategy {
  constructor(
    private baseDelayMs: number = 2500,
    private maxDelayMs: number = 30000,
    private multiplier: number = 2,
    private jitterMax: number = 500,
    private randomProvider: IRandomProvider = new DefaultRandomProvider()
  ) {}

  getNextDelayMs(attempt: number, lastError?: unknown): number {
    if (lastError) {
      // If there is an error, apply exponential backoff
      const backoff = this.baseDelayMs * Math.pow(this.multiplier, attempt - 1);
      const delay = Math.min(backoff, this.maxDelayMs);
      return delay + this.randomProvider.random() * this.jitterMax; // Add jitter
    }
    // No error, keep the base delay
    return this.baseDelayMs;
  }

  withBaseDelay(delay: number): IDelayStrategy {
    return new ExponentialBackoffDelayStrategy(
      delay,
      this.maxDelayMs,
      this.multiplier,
      this.jitterMax,
      this.randomProvider
    );
  }
}
