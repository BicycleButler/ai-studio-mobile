import { BaseApiError } from "../apiClientErrors";

export interface IOfflineRetryStrategy {
  shouldEnqueue(error: unknown): boolean;
}

export class DefaultOfflineRetryStrategy implements IOfflineRetryStrategy {
  public shouldEnqueue(error: unknown): boolean {
    if (error instanceof BaseApiError) {
      // Enqueue if it is a network error (0) or a server error (>= 500) or rate limited (429) or timeout (408)
      const status = error.statusCode;
      if (status === 0 || status >= 500 || status === 429 || status === 408) {
        return true;
      }
      // Do not enqueue client errors (400, 401, 403, 404, and so on.)
      return false;
    }
    // If it is not a BaseApiError, assume it is a network-level failure or fetch error that must be retried.
    return true;
  }
}
