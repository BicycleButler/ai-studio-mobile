import { BaseApiError } from "../apiClientErrors";

export class SyncAdapterError extends BaseApiError {
  constructor(message: string, endpoint?: string, originalError?: Error) {
    // 0 is often used as a dummy status code for non-HTTP errors like config issues
    super(message, 0, undefined, endpoint, originalError);
    this.name = "SyncAdapterError";
  }
}
