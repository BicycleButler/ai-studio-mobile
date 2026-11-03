import { BaseApiError } from "./apiClientErrors";

export interface IResponseParser {
  parse<T>(response: Response, endpoint: string): Promise<T>;
  parseStream(response: Response, endpoint: string): Promise<Response>;
}

export class DefaultResponseParser implements IResponseParser {
  public async parseStream(response: Response, _endpoint: string): Promise<Response> {
    return response;
  }

  public async parse<T>(response: Response, endpoint: string): Promise<T> {
    if (response.status === 204) {
      return {} as T;
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      try {
        return await response.json() as T;
      } catch (err: unknown) {
        const headersRecord: Record<string, string> = {};
        response.headers.forEach((value, key) => { headersRecord[key] = value; });
        throw BaseApiError.fromResponse("Invalid JSON response from server", response.status, headersRecord, endpoint, err);
      }
    }

    const text = await response.text();
    return (text as unknown) as T;
  }
}
