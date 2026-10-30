import { IApiClient } from "../apiClient";
import { ISyncTransport } from "./syncAdapter";

/**
 * An ISyncTransport implementation that specifically abstracts payload serialization
 * for HTTP requests expecting multipart/form-data.
 * This satisfies Path 2 of the "NetworkStorageSyncAdapter Payload Abstraction" architectural decision,
 * generalizing network sync for non-JSON payloads.
 */
export class FormDataSyncTransport<T> implements ISyncTransport<T> {
  constructor(
    private apiClient: IApiClient,
    private formDataBuilder: (item: T) => FormData
  ) {}

  public async transmit(endpoint: string, item: T, method: string): Promise<void> {
    const formData = this.formDataBuilder(item);

    const requestInit: RequestInit = {
      method,
      // Note: When using FormData with fetch, you should NOT set the Content-Type header manually.
      // The browser will automatically set it to multipart/form-data with the correct boundary.
      body: formData,
    };

    await this.apiClient.fetch(endpoint, requestInit);
  }
}
