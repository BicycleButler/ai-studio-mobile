import { describe, it, expect, vi } from "vitest";
import { ApiClient } from "./apiClient";
import { InterceptorManager } from "./apiClientInterceptors";
import { DefaultResponseParser } from "./apiResponseParser";
import { DefaultUrlBuilder } from "./urlUtils";

function createTestClient(fetcher: typeof fetch) {
  return new ApiClient({
    interceptorManager: new InterceptorManager(),
    responseParser: new DefaultResponseParser(),
    urlBuilder: new DefaultUrlBuilder(),
    retryConfig: { retries: 0, fetcher },
  });
}

describe("ApiClient in-flight GET deduplication", () => {
  it("coalesces concurrent identical GET requests into a single network fetch", async () => {
    let resolveFetch!: (res: Response) => void;
    const mockFetch = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );

    const client = createTestClient(mockFetch as unknown as typeof fetch);
    const p1 = client.fetch<{ ok: boolean }>("/api/models");
    const p2 = client.fetch<{ ok: boolean }>("/api/models");

    // Allow microtasks from prepareRequest to flush
    await new Promise((r) => setTimeout(r, 0));
    expect(mockFetch).toHaveBeenCalledTimes(1);

    resolveFetch(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual({ ok: true });
    expect(r2).toEqual({ ok: true });

    // A subsequent GET after settlement triggers a fresh fetch
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const r3 = await client.fetch<{ ok: boolean }>("/api/models");
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(r3).toEqual({ ok: false });
  });

  it("does not deduplicate POST requests or GET requests with custom AbortSignals", async () => {
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const client = createTestClient(mockFetch as unknown as typeof fetch);
    const c1 = new AbortController();
    const c2 = new AbortController();

    await Promise.all([
      client.fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompts: [] }),
      }),
      client.fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompts: [] }),
      }),
    ]);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    await Promise.all([
      client.fetch("/api/models", { signal: c1.signal }),
      client.fetch("/api/models", { signal: c2.signal }),
    ]);
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it("does not coalesce requests with different headers", async () => {
    let resolveA!: (res: Response) => void;
    let resolveB!: (res: Response) => void;
    const mockFetch = vi
      .fn()
      .mockImplementationOnce(() => new Promise<Response>((r) => (resolveA = r)))
      .mockImplementationOnce(() => new Promise<Response>((r) => (resolveB = r)));

    const client = createTestClient(mockFetch as unknown as typeof fetch);
    const pA = client.fetch<{ key: string }>("/api/models", {
      headers: { "x-gemini-api-key": "key-a" },
    });
    const pB = client.fetch<{ key: string }>("/api/models", {
      headers: { "x-gemini-api-key": "key-b" },
    });

    await new Promise((r) => setTimeout(r, 0));
    expect(mockFetch).toHaveBeenCalledTimes(2);
    resolveA(
      new Response(JSON.stringify({ key: "a" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    resolveB(
      new Response(JSON.stringify({ key: "b" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(await pA).toEqual({ key: "a" });
    expect(await pB).toEqual({ key: "b" });
  });
});
