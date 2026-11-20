// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import http from "node:http";
import zlib from "node:zlib";
import { AddressInfo } from "node:net";
import { createApp } from "../server";
import { ServerStateStore } from "./stateStore";
import { getGenAIClient, clearGenAIClientCache } from "./utils/genai";

function startTestServer(app: ReturnType<typeof createApp>["app"]): Promise<{
  server: http.Server;
  baseUrl: string;
}> {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

function rawHttpGet(
  url: string,
  headers: Record<string, string> = {}
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: Buffer.concat(chunks),
        });
      });
    });
    req.on("error", reject);
  });
}

describe("Server performance & reliability optimizations", () => {
  afterEach(() => {
    clearGenAIClientCache();
    vi.restoreAllMocks();
  });

  it("caches GoogleGenAI client instances by API key hash and isolates distinct keys", () => {
    const clientA1 = getGenAIClient("test-key-alpha-1234567890");
    const clientA2 = getGenAIClient("test-key-alpha-1234567890");
    const clientB = getGenAIClient("test-key-beta-0987654321");

    expect(clientA1).toBe(clientA2);
    expect(clientA1).not.toBe(clientB);
  });

  it("coalesces concurrent /api/models cache misses into a single upstream list() call", async () => {
    const store = new ServerStateStore(":memory:");
    let resolveList!: (val: AsyncIterable<{ name: string; supportedActions: string[] }>) => void;
    const listMock = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        })
    );

    const { app } = createApp({
      stateStore: store,
      getGenAIClient: () =>
        ({
          models: {
            list: listMock,
          },
        }) as unknown as ReturnType<typeof getGenAIClient>,
    });

    const { server, baseUrl } = await startTestServer(app);
    try {
      const p1 = rawHttpGet(`${baseUrl}/api/models`, {
        "x-gemini-api-key": "test-single-flight-key-123456",
      });
      const p2 = rawHttpGet(`${baseUrl}/api/models`, {
        "x-gemini-api-key": "test-single-flight-key-123456",
      });

      await new Promise((r) => setTimeout(r, 30));
      expect(listMock).toHaveBeenCalledTimes(1);

      resolveList({
        async *[Symbol.asyncIterator]() {
          yield {
            name: "models/gemini-2.5-flash",
            supportedActions: ["generateContent"],
          };
        },
      });

      const [res1, res2] = await Promise.all([p1, p2]);
      expect(res1.statusCode).toBe(200);
      expect(res2.statusCode).toBe(200);
      expect(JSON.parse(res1.body.toString("utf8")).liveSynced).toBe(true);
      expect(JSON.parse(res2.body.toString("utf8")).liveSynced).toBe(true);
      expect(listMock).toHaveBeenCalledTimes(1);
    } finally {
      await closeServer(server);
      store.close();
    }
  });

  it("compresses large JSON API responses when Accept-Encoding: gzip is requested", async () => {
    const store = new ServerStateStore(":memory:");
    const { app } = createApp({ stateStore: store });
    const { server, baseUrl } = await startTestServer(app);

    try {
      const res = await rawHttpGet(`${baseUrl}/api/models`, {
        "Accept-Encoding": "gzip",
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-encoding"]).toBe("gzip");
      const decompressed = zlib.gunzipSync(res.body).toString("utf8");
      const parsed = JSON.parse(decompressed);
      expect(Array.isArray(parsed.models)).toBe(true);
      expect(parsed.models.length).toBeGreaterThan(0);
    } finally {
      await closeServer(server);
      store.close();
    }
  });

  it("throttles SQLite quick_check while keeping ping() responsive", () => {
    const store = new ServerStateStore(":memory:");
    const baseTime = 1_700_000_000_000;
    expect(store.ping(baseTime)).toBe(true);
    expect(store.ping(baseTime + 1_000)).toBe(true);
    expect(store.ping(baseTime + 65_000)).toBe(true);
    store.close();
  });
});
